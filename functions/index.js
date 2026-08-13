const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { checkRateLimit, LIMITS } = require("./rateLimiter");
const { isCallerAdmin } = require("./adminEmails");
const asaas = require("./asaas");

admin.initializeApp();
const db = admin.firestore();

// Credenciais do Asaas via Secret Manager, não via .env: um .env é empacotado no deploy
// e fica legível para qualquer pessoa com acesso ao projeto. Declaradas aqui e ligadas
// às funções que precisam delas — o Firebase injeta em process.env em tempo de execução,
// então asaas.js continua lendo process.env.ASAAS_API_KEY sem saber a diferença.
// Localmente o emulador cai no functions/.env (chave de sandbox).
const ASAAS_API_KEY = defineSecret("ASAAS_API_KEY");
const ASAAS_WEBHOOK_TOKEN = defineSecret("ASAAS_WEBHOOK_TOKEN");

// Envia uma notificação push (FCM) para todos os dispositivos de um usuário.
// Nunca lança erro: falha de notificação não pode comprometer o processamento do pagamento.
async function enviarNotificacaoPush(userId, title, body, link) {
    if (!userId) return;
    try {
        const tokensSnap = await db.collection('fcmTokens').where('userId', '==', userId).get();
        if (tokensSnap.empty) return;

        const tokens = tokensSnap.docs.map(d => d.data().token).filter(Boolean);
        if (tokens.length === 0) return;

        const message = {
            tokens,
            notification: { title, body },
            data: {
                type: 'app',
                link: link || '/profile'
            },
            webpush: {
                notification: { icon: '/apple-touch-icon.png' },
                fcmOptions: { link: link || '/profile' }
            }
        };

        const resp = await admin.messaging().sendEachForMulticast(message);

        // Remove tokens que o FCM reportou como inválidos/expirados (limpeza de base).
        const removals = [];
        resp.responses.forEach((r, idx) => {
            if (!r.success) {
                const code = r.error?.code || '';
                if (
                    code === 'messaging/registration-token-not-registered' ||
                    code === 'messaging/invalid-registration-token' ||
                    code === 'messaging/invalid-argument'
                ) {
                    removals.push(db.collection('fcmTokens').doc(tokens[idx]).delete().catch(() => {}));
                }
            }
        });
        await Promise.all(removals);

        logger.info(`Notificação push enviada para o usuário ${userId}: ${resp.successCount}/${tokens.length} entregues.`);
    } catch (err) {
        logger.error('Erro ao enviar notificação push (ignorado):', err);
    }
}

// Inicia o estorno total de uma cobrança no Asaas (resolução automática de overbooking).
// A reversão de estoque e a remoção das inscrições são feitas pelo próprio webhook quando o
// Asaas confirmar o estorno (PAYMENT_REFUNDED). Nunca lança erro.
//
// Como a cobrança é da plataforma, o estorno usa a nossa chave — não há token de vendedor
// para resolver. O Asaas desfaz o split junto com o estorno.
async function reembolsarPagamentoAutomatico(paymentId) {
    if (!paymentId) return false;
    try {
        await asaas.estornarCobranca(paymentId);
        logger.info(`Estorno automático (overbooking) iniciado para a cobrança ${paymentId}.`);
        return true;
    } catch (e) {
        logger.error(`Falha ao estornar automaticamente a cobrança ${paymentId}:`, e);
        return false;
    }
}

exports.criarCobrancaPix = onCall({ cors: true, secrets: [ASAAS_API_KEY] }, async (request) => {
    const data = request.data;
    const { valor, cpf, email, pedidoId } = data;
    
    // Sem CPF/e-mail no log: dado pessoal não precisa ficar retido no Cloud Logging.
    logger.info("Criando cobrança Pix. Pedido:", pedidoId, "Valor:", valor);
    
    if (!valor || !email || !pedidoId) {
        throw new HttpsError('invalid-argument', 'Dados incompletos para gerar o Pix.');
    }

    // Compra exige conta (Termos de Uso) — também elimina o balde anônimo do rate limit.
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Faça login para comprar ingressos.');
    }

    // Rate Limiting: uid autenticado ou IP (primeiro hop do x-forwarded-for). Nunca
    // identificadores do payload (deviceId/userId): o cliente controla e rotaciona,
    // o que zeraria o limite. IP compartilhado (CGNAT) pode agrupar compradores — ceiling aceito.
    const forwarded = String(request.rawRequest?.headers?.['x-forwarded-for'] || '');
    const clientIp = forwarded.split(',')[0].trim() || request.rawRequest?.ip || '';
    const rateLimitKey = request.auth?.uid || clientIp || 'anonymous';
    // Rate Limiting: 5 cobranças por minuto
    const rlMinuto = await checkRateLimit(rateLimitKey, 'criarCobrancaPix', LIMITS.CRIAR_COBRANCA.max, LIMITS.CRIAR_COBRANCA.windowSec);
    if (!rlMinuto.allowed) {
        throw new HttpsError('resource-exhausted', `Limite de cobranças atingido. Tente novamente em ${Math.ceil(rlMinuto.retryAfterMs / 1000)} segundos.`);
    }
    // Rate Limiting: 20 cobranças por hora
    const rlHora = await checkRateLimit(rateLimitKey, 'criarCobrancaPix_hora', LIMITS.CRIAR_COBRANCA_HORA.max, LIMITS.CRIAR_COBRANCA_HORA.windowSec);
    if (!rlHora.allowed) {
        throw new HttpsError('resource-exhausted', `Limite de cobranças por hora atingido. Tente novamente em ${Math.ceil(rlHora.retryAfterMs / 1000)} segundos.`);
    }

    const eventId = data.eventId || "ingresso";
    const itensSelecionados = data.itensSelecionados || [];

    try {
        // Validação preventiva de estoque antes de gerar a cobrança Pix
        const eventRef = db.collection('events').doc(eventId);
        const eventDoc = await eventRef.get();
        if (!eventDoc.exists) {
            throw new HttpsError('not-found', 'Evento correspondente não foi encontrado.');
        }
        const eventData = eventDoc.data();

        // ─── SPLIT: para qual carteira vai a parte do organizador? ───
        // A cobrança é sempre NOSSA (chave da plataforma); o split repassa a parte dele.
        // Sem recebedor cadastrado não há split: fica tudo na plataforma, como antes.
        // ponytail: retaguarda proposital. Para exigir cadastro, troque o logger.warn
        // abaixo por um HttpsError('failed-precondition') — o resto do fluxo não muda.
        const creatorId = eventData.creatorId || '';
        const recebedor = await asaas.getRecebedor(creatorId);
        if (!recebedor) {
            logger.warn(`Organizador ${creatorId} do evento ${eventId} sem recebedor Asaas. Cobrando sem split.`);
        }

        if (eventData.tickets && itensSelecionados.length > 0) {
            const tickets = eventData.tickets || [];
            for (const item of itensSelecionados) {
                const ticketOriginal = tickets.find(t => t.id === item.id);
                if (ticketOriginal) {
                    const available = ticketOriginal.capacity - (ticketOriginal.sold || 0);
                    if (Number(item.quantity) > available) {
                        throw new HttpsError('failed-precondition', `Desculpe, o ingresso "${ticketOriginal.name}" esgotou ou não possui a quantidade solicitada disponível.`);
                    }
                }
            }
        }

        const clienteNome = data.clienteNome || "Comprador";
        const clienteTelefone = data.clienteTelefone || "";
        const cleanCpf = (cpf || "").replace(/\D/g, "");
        if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
            // O Asaas recusa o cadastro do cliente sem CPF/CNPJ válido. Barrar aqui dá uma
            // mensagem útil ao comprador em vez de um erro genérico vindo do gateway.
            throw new HttpsError('invalid-argument', 'Informe um CPF ou CNPJ válido para gerar o Pix.');
        }

        const eventTitle = data.eventTitle || "Ingresso Atchei";

        // Processar múltiplos ingressos (VIP, Camarote, etc.) e lotes selecionados.
        // SEGURANÇA: o preço é SEMPRE obtido do documento do evento no servidor.
        // O preço enviado pelo cliente é ignorado para impedir fraude de valor.
        const ticketsDoEvento = eventData.tickets || [];
        let valorTotal = Number(valor);

        if (itensSelecionados.length > 0) {
            let somaValores = 0;
            for (const item of itensSelecionados) {
                const qty = Number(item.quantity) || 0;
                if (qty <= 0) continue;

                const ticketReal = ticketsDoEvento.find(t => t.id === item.id);
                if (!ticketReal) {
                    throw new HttpsError('failed-precondition', `O ingresso "${item.name || item.id}" não está disponível neste evento.`);
                }
                somaValores += (Number(ticketReal.price) || 0) * qty;
            }
            if (somaValores <= 0) {
                throw new HttpsError('invalid-argument', 'Nenhum ingresso válido foi selecionado.');
            }
            valorTotal = somaValores;
        } else {
            // Fallback de lote único: usa o preço PIX configurado no evento, não o valor do cliente.
            // pixTicketPrice é string (ex.: "50" ou "R$ 50,00"); extrai o número de forma robusta.
            const precoEventoStr = String(eventData.pixTicketPrice ?? '').replace(/[^\d.,]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.');
            const precoEvento = Number(precoEventoStr);
            if (precoEvento > 0) {
                valorTotal = precoEvento;
            }
        }

        // Repartição do valor. Inverte a lógica do Mercado Pago: lá declarávamos a nossa
        // comissão, aqui declaramos quanto vai para o organizador — o resto fica conosco.
        // Percentual, não valor fixo: ver a justificativa em asaas.js (teto do netValue).
        const { percentualOrganizador, feeEstimada, repasseEstimado } =
            asaas.calcSplit(valorTotal, asaas.platformFeePercent());
        const split = (recebedor && percentualOrganizador > 0)
            ? [{ walletId: recebedor.walletId, percentualValue: percentualOrganizador }]
            : undefined;

        // Evita rebaixar um pedido já processado: se o mesmo pedidoId for reusado após o pagamento,
        // o set merge abaixo sobrescreveria status='pago' por 'pendente'. Bloqueia antes de gerar o Pix.
        const pedidoExistenteSnap = await db.collection('pedidos').doc(pedidoId).get();
        if (pedidoExistenteSnap.exists && ['pago', 'estornado', 'chargeback', 'cancelado'].includes(pedidoExistenteSnap.data().status)) {
            throw new HttpsError('failed-precondition', 'Este pedido já foi processado.');
        }

        // O Asaas exige um `customer` cadastrado — não aceita os dados do pagador inline.
        const customerId = await asaas.buscarOuCriarCliente({
            name: clienteNome,
            cpfCnpj: cleanCpf,
            email,
            mobilePhone: clienteTelefone,
        });

        const cobranca = await asaas.criarCobrancaPix({
            customer: customerId,
            value: valorTotal,
            description: `${eventTitle} — pedido ${pedidoId}`.substring(0, 500),
            // `externalReference` é o elo com o nosso pedido: é por ele que o webhook
            // reencontra a compra, exatamente como o external_reference fazia no MP.
            externalReference: pedidoId,
            split,
        });

        // No Asaas o QR Code é uma segunda chamada; o POST /payments não o devolve.
        const qr = await asaas.obterQrCodePix(cobranca.id);

        await db.collection('pedidos').doc(pedidoId).set({
            id: pedidoId,
            valor: valorTotal,
            clienteEmail: email,
            clienteNome: clienteNome,
            clienteTelefone: clienteTelefone,
            clienteCpf: cleanCpf,
            eventId: eventId,
            eventTitle: eventTitle, // Guarda o título para usar no texto da notificação push (sem leitura extra)
            userId: data.userId || '',
            status: 'pendente',
            itensComprados: itensSelecionados, // Grava os ingressos do lote para atualizar estoque na aprovação
            asaasPaymentId: cobranca.id,
            // Rastro do split. Os valores em reais são ESTIMATIVAS sobre o bruto: o Asaas
            // reparte sobre o netValue (bruto − tarifa dele), então o repasse real chega
            // no webhook. Servem para o painel não ficar mostrando só o bruto.
            sellerCreatorId: creatorId,
            sellerWalletId: recebedor?.walletId || null,
            split: !!split,
            splitPercentualOrganizador: split ? percentualOrganizador : 0,
            applicationFee: split ? feeEstimada : 0,
            valorLiquidoOrganizador: split ? repasseEstimado : 0,
            dataCriacao: FieldValue.serverTimestamp(),
        }, { merge: true });

        // Formato de retorno inalterado: o frontend continua consumindo qr_code/qr_code_base64.
        return {
            id: cobranca.id,
            qr_code: qr.qr_code,
            qr_code_base64: qr.qr_code_base64
        };

    } catch (error) {
        if (error instanceof HttpsError) {
            throw error;
        }
        logger.error("Erro ao criar cobrança Pix:", error);
        throw new HttpsError('internal', 'Erro ao processar pagamento Pix.');
    }
});

exports.webhookAsaas = onRequest({ cors: true, secrets: [ASAAS_API_KEY, ASAAS_WEBHOOK_TOKEN] }, async (req, res) => {
    // Rate Limiting: 60 requests por minuto por IP
    const clientIp = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    const rlWebhook = await checkRateLimit(clientIp, 'webhookAsaas', LIMITS.WEBHOOK.max, LIMITS.WEBHOOK.windowSec);
    if (!rlWebhook.allowed) {
        const retryAfterSec = Math.ceil(rlWebhook.retryAfterMs / 1000);
        res.set('Retry-After', String(retryAfterSec));
        res.status(429).send(`Rate limit excedido. Tente novamente em ${retryAfterSec} segundos.`);
        return;
    }

    // ─── Autenticação do webhook ───
    // DIFERENÇA IMPORTANTE EM RELAÇÃO AO MERCADO PAGO: o MP assinava cada payload com
    // HMAC-SHA256, o que provava a integridade da mensagem. O Asaas oferece apenas um
    // token estático, que você define ao cadastrar o webhook e ele devolve no header
    // `asaas-access-token`. É segredo compartilhado, não assinatura — quem obtiver o
    // token consegue forjar notificações. Daí o fail-closed abaixo e, mais adiante, a
    // reconsulta da cobrança na API em vez de acreditar no corpo da requisição.
    const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;
    if (!tokenEsperado) {
        if (process.env.FUNCTIONS_EMULATOR === 'true') {
            logger.warn("ASAAS_WEBHOOK_TOKEN ausente — validação ignorada (apenas no emulador).");
        } else {
            logger.error("ASAAS_WEBHOOK_TOKEN não configurado em produção. Rejeitando webhook.");
            res.status(500).send('Configuração de segurança ausente.');
            return;
        }
    } else {
        const crypto = require('crypto');
        const recebido = Buffer.from(String(req.headers['asaas-access-token'] || ''));
        const esperado = Buffer.from(tokenEsperado);
        const tokenOk = recebido.length === esperado.length && crypto.timingSafeEqual(recebido, esperado);
        if (!tokenOk) {
            logger.error("Token do webhook do Asaas inválido. Acesso não autorizado.");
            res.status(401).send('Token não autorizado.');
            return;
        }
    }

    const evento = req.body?.event || '';
    const paymentId = req.body?.payment?.id;
    logger.info("Webhook Asaas recebido. Evento:", evento, "Pagamento:", paymentId);

    if (!paymentId) {
        res.status(400).send('Payload sem id de pagamento.');
        return;
    }

    try {
        // NÃO confiamos no status que veio no corpo. Sem assinatura no payload, um token
        // vazado bastaria para forjar "pagamento recebido" e emitir ingresso de graça.
        // Reconsultar a cobrança na API do Asaas é o que mantém a garantia que o
        // `payment.get()` dava no fluxo do Mercado Pago.
        let pagamento = null;
        try {
            pagamento = await asaas.consultarCobranca(paymentId);
        } catch (e) {
            if (e.status === 404) {
                // Cobrança removida no Asaas: trata como cancelamento (o caminho de
                // estorno só reverte estoque/inscrição se o pedido chegou a ser pago).
                logger.warn(`Cobrança ${paymentId} não existe mais no Asaas. Tratando como cancelada.`);
            } else {
                throw e;
            }
        }

        // Status reais do Asaas traduzidos para o vocabulário interno que as transações
        // abaixo já usam. Só a tradução é nova; estoque, inscrições, idempotência e
        // reembolso automático de overbooking seguem exatamente como estavam.
        const STATUS = {
            RECEIVED: 'approved',
            CONFIRMED: 'approved',
            RECEIVED_IN_CASH: 'approved',
            REFUNDED: 'refunded',
            CHARGEBACK_REQUESTED: 'charged_back',
            CHARGEBACK_DISPUTE: 'charged_back',
        };
        const statusReal = pagamento ? STATUS[pagamento.status] : 'cancelled';

        // Eventos que não mexem no ingresso (PAYMENT_CREATED, PAYMENT_UPDATED,
        // PAYMENT_OVERDUE, cobrança ainda PENDING…). Responder 200 evita reenfileiramento.
        if (!statusReal) {
            logger.info(`Evento ${evento} (status ${pagamento?.status}) ignorado: não altera o ingresso.`);
            res.status(200).send('Evento ignorado.');
            return;
        }

        const externalReference = pagamento?.externalReference || req.body?.payment?.externalReference;
        const pedidosRef = db.collection('pedidos');
        let pedidoDoc = null;
        let dadosPedido = null;

        // Busca direta por externalReference (pedidoId)
        if (externalReference) {
            const docSnap = await pedidosRef.doc(externalReference).get();
            if (docSnap.exists) {
                pedidoDoc = docSnap;
                dadosPedido = docSnap.data();
            }
        }

        // Fallback por asaasPaymentId se não achou por externalReference
        if (!dadosPedido) {
            const querySnapshot = await pedidosRef.where('asaasPaymentId', '==', paymentId).limit(1).get();
            if (!querySnapshot.empty) {
                pedidoDoc = querySnapshot.docs[0];
                dadosPedido = pedidoDoc.data();
            }
        }

        if (!dadosPedido) {
            logger.error(`Pedido correspondente ao pagamento MP ID ${paymentId} não encontrado no Firestore.`);
            res.status(404).send('Pedido não encontrado.');
            return;
        }
        
        let isOverbooked = false;
        let statusPedidoAtual = '';
        // Sinaliza que a compra acabou de ser confirmada AGORA (transição pendente -> pago),
        // para disparar a notificação push apenas uma vez, ignorando webhooks redundantes.
        let deveNotificar = false;

        if (statusReal === 'approved') {
            // Toda a operação de aprovação ocorre de forma atômica dentro de uma transação
            try {
                await db.runTransaction(async (transaction) => {
                    // Reinicia as flags a cada tentativa: o Firestore pode reexecutar este callback
                    // em caso de contenção (retry), e um valor true de uma tentativa abortada não pode
                    // vazar para a próxima (evita overbooking/notificação falsos após recomputar leituras).
                    isOverbooked = false;
                    deveNotificar = false;

                    const pedidoRef = pedidosRef.doc(pedidoDoc.id);
                    const currentPedidoDoc = await transaction.get(pedidoRef);

                    if (!currentPedidoDoc.exists) {
                        throw new Error("Pedido não encontrado na transação.");
                    }

                    const currentPedidoData = currentPedidoDoc.data();
                    statusPedidoAtual = currentPedidoData.status;

                    // Se o pedido já está em qualquer estado terminal, aborta para evitar que um
                    // 'approved' tardio/retry do Mercado Pago ressuscite um pedido pago/estornado/cancelado
                    // (reprocessamento recriaria inscrições determinísticas e corromperia o estoque).
                    if (['pago', 'estornado', 'chargeback', 'cancelado'].includes(statusPedidoAtual)) {
                        logger.info(`Pedido ${pedidoDoc.id} já está em estado terminal (${statusPedidoAtual}). Abortando aprovação redundante/tardia.`);
                        return;
                    }

                    // Transição efetiva para pago: libera o envio da notificação push após a transação
                    deveNotificar = true;

                    // 1. Atualizar o pedido para Pago
                    transaction.update(pedidoRef, {
                        status: 'pago',
                        dataPagamento: FieldValue.serverTimestamp()
                    });
                    
                    const itensComprados = currentPedidoData.itensComprados || [];
                    
                    // 2. Decrementar estoque dos ingressos correspondentes no evento
                    if (currentPedidoData.eventId && itensComprados.length > 0) {
                        const eventRef = db.collection('events').doc(currentPedidoData.eventId);
                        const eventDoc = await transaction.get(eventRef);
                        
                        if (eventDoc.exists) {
                            const eventData = eventDoc.data();
                            const tickets = eventData.tickets || [];
                            
                            // Mapear as compras de cada ticketId neste pedido
                            const vendasMap = {};
                            for (const item of itensComprados) {
                                vendasMap[item.id] = (vendasMap[item.id] || 0) + (Number(item.quantity) || 0);
                            }
                            
                            let alterado = false;
                            const updatedTickets = tickets.map(ticket => {
                                const qtdVendida = vendasMap[ticket.id];
                                if (qtdVendida) {
                                    alterado = true;
                                    const novoSold = (ticket.sold || 0) + qtdVendida;
                                    if (novoSold > ticket.capacity) {
                                        isOverbooked = true; // Houve estouro de estoque (venda simultânea)
                                    }
                                    const novoStatus = novoSold >= ticket.capacity ? 'sold_out' : ticket.status;
                                    return {
                                        ...ticket,
                                        sold: novoSold,
                                        status: novoStatus
                                    };
                                }
                                return ticket;
                            });
                            
                            if (alterado) {
                                transaction.update(eventRef, { tickets: updatedTickets });
                                logger.info(`Estoque atualizado no evento ${currentPedidoData.eventId} para os tickets:`, Object.keys(vendasMap));
                            }
                        }
                    }
                    
                    if (isOverbooked) {
                        transaction.update(pedidoRef, { overbooked: true });
                        logger.warn(`Alerta de Overbooking detectado no pedido ${pedidoDoc.id}`);
                    }
                    
                    // 3. Criar inscrições na coleção registrations
                    // O ID da inscrição agora é 100% determinístico e idempotente (usa o id do pedido e o índice), eliminando duplicações
                    if (itensComprados.length > 0) {
                        for (const item of itensComprados) {
                            const qty = Number(item.quantity) || 0;
                            for (let q = 0; q < qty; q++) {
                                const registrationId = `reg_${currentPedidoData.eventId}_${currentPedidoData.userId}_${item.id}_${q}_${pedidoDoc.id}`;
                                const regRef = db.collection('registrations').doc(registrationId);
                                transaction.set(regRef, {
                                    id: registrationId,
                                    eventId: currentPedidoData.eventId || '',
                                    userId: currentPedidoData.userId || '',
                                    userName: currentPedidoData.clienteNome || '',
                                    userEmail: currentPedidoData.clienteEmail || '',
                                    // Chave de busca da recuperação por email-link (e-mail normalizado).
                                    userEmailLower: (currentPedidoData.clienteEmail || '').trim().toLowerCase(),
                                    userPhone: currentPedidoData.clienteTelefone || '',
                                    userCpf: currentPedidoData.clienteCpf || '',
                                    paymentStatus: isOverbooked ? 'Overbooking (Pago)' : 'Pago',
                                    overbooked: isOverbooked,
                                    ticketTypeId: item.id,
                                    ticketTypeName: item.name,
                                    pedidoId: pedidoDoc.id,
                                    timestamp: new Date().toISOString()
                                });
                            }
                        }
                        logger.info(`Transação: Pedido ${pedidoDoc.id} processado! Inscrições criadas.`);
                    } else {
                        const registrationId = `reg_${currentPedidoData.eventId}_${currentPedidoData.userId}_${pedidoDoc.id}`;
                        const regRef = db.collection('registrations').doc(registrationId);
                        transaction.set(regRef, {
                            id: registrationId,
                            eventId: currentPedidoData.eventId || '',
                            userId: currentPedidoData.userId || '',
                            userName: currentPedidoData.clienteNome || '',
                            userEmail: currentPedidoData.clienteEmail || '',
                            // Chave de busca da recuperação por email-link (e-mail normalizado).
                            userEmailLower: (currentPedidoData.clienteEmail || '').trim().toLowerCase(),
                            userPhone: currentPedidoData.clienteTelefone || '',
                            userCpf: currentPedidoData.clienteCpf || '',
                            paymentStatus: isOverbooked ? 'Overbooking (Pago)' : 'Pago',
                            overbooked: isOverbooked,
                            pedidoId: pedidoDoc.id,
                            timestamp: new Date().toISOString()
                        });
                        logger.info(`Transação: Pedido ${pedidoDoc.id} processado! Inscrição simples criada.`);
                    }
                });
            } catch (transError) {
                logger.error("Erro na transação de aprovação do pedido:", transError);
                res.status(500).send('Erro na transação do banco.');
                return;
            }
        }

        // Tratamento de estorno, chargeback e cancelamento.
        // Se o pedido já havia sido pago, devolvemos o estoque ao evento e removemos as
        // inscrições geradas, impedindo que um ingresso estornado continue válido na portaria.
        const REFUND_STATUSES = ['refunded', 'cancelled', 'charged_back'];
        if (REFUND_STATUSES.includes(statusReal)) {
            try {
                await db.runTransaction(async (transaction) => {
                    const pedidoRef = pedidosRef.doc(pedidoDoc.id);

                    // IMPORTANTE: todas as leituras devem ocorrer antes de qualquer escrita na transação.
                    const currentPedidoDoc = await transaction.get(pedidoRef);
                    if (!currentPedidoDoc.exists) {
                        throw new Error("Pedido não encontrado na transação de estorno.");
                    }
                    const currentPedidoData = currentPedidoDoc.data();
                    const statusAtual = currentPedidoData.status;

                    const novoStatusPedido = statusReal === 'charged_back'
                        ? 'chargeback'
                        : (statusReal === 'refunded' ? 'estornado' : 'cancelado');

                    // Idempotência: se já está em um estado final de estorno, não faz nada.
                    if (['estornado', 'chargeback', 'cancelado'].includes(statusAtual)) {
                        logger.info(`Pedido ${pedidoDoc.id} já está em estado final (${statusAtual}). Ignorando estorno redundante.`);
                        return;
                    }

                    // Só revertemos estoque/inscrições se o pedido chegou a ser efetivamente pago.
                    const eraPago = statusAtual === 'pago';
                    const itensComprados = currentPedidoData.itensComprados || [];

                    // Leitura do evento (antes das escritas) apenas quando há estoque a devolver.
                    let eventDoc = null;
                    let eventRef = null;
                    if (eraPago && currentPedidoData.eventId && itensComprados.length > 0) {
                        eventRef = db.collection('events').doc(currentPedidoData.eventId);
                        eventDoc = await transaction.get(eventRef);
                    }

                    // 1. Atualiza o status do pedido
                    transaction.update(pedidoRef, {
                        status: novoStatusPedido,
                        dataEstorno: FieldValue.serverTimestamp()
                    });

                    if (!eraPago) {
                        // Pedido nunca foi pago (ex.: Pix expirado). Nada de estoque/inscrições a reverter.
                        logger.info(`Pedido ${pedidoDoc.id} marcado como ${novoStatusPedido} (não havia sido pago).`);
                        return;
                    }

                    // 2. Devolve o estoque dos lotes ao evento
                    if (eventDoc && eventDoc.exists) {
                        const eventData = eventDoc.data();
                        const tickets = eventData.tickets || [];
                        const devolucoesMap = {};
                        for (const item of itensComprados) {
                            devolucoesMap[item.id] = (devolucoesMap[item.id] || 0) + (Number(item.quantity) || 0);
                        }
                        let alterado = false;
                        const updatedTickets = tickets.map(ticket => {
                            const qtdDevolvida = devolucoesMap[ticket.id];
                            if (qtdDevolvida) {
                                alterado = true;
                                const novoSold = Math.max(0, (ticket.sold || 0) - qtdDevolvida);
                                // Reabre o lote se estava esgotado e voltou a ter vaga
                                const novoStatus = ticket.status === 'sold_out' && novoSold < ticket.capacity
                                    ? 'active'
                                    : ticket.status;
                                return { ...ticket, sold: novoSold, status: novoStatus };
                            }
                            return ticket;
                        });
                        if (alterado) {
                            transaction.update(eventRef, { tickets: updatedTickets });
                            logger.info(`Estoque devolvido no evento ${currentPedidoData.eventId} após ${novoStatusPedido} do pedido ${pedidoDoc.id}.`);
                        }
                    }

                    // 3. Remove as inscrições criadas por este pedido (IDs determinísticos,
                    // idênticos aos gerados na aprovação). O contador é ajustado por onRegistrationDeleted.
                    if (itensComprados.length > 0) {
                        for (const item of itensComprados) {
                            const qty = Number(item.quantity) || 0;
                            for (let q = 0; q < qty; q++) {
                                const registrationId = `reg_${currentPedidoData.eventId}_${currentPedidoData.userId}_${item.id}_${q}_${pedidoDoc.id}`;
                                transaction.delete(db.collection('registrations').doc(registrationId));
                            }
                        }
                    } else {
                        const registrationId = `reg_${currentPedidoData.eventId}_${currentPedidoData.userId}_${pedidoDoc.id}`;
                        transaction.delete(db.collection('registrations').doc(registrationId));
                    }
                    logger.info(`Inscrições do pedido ${pedidoDoc.id} removidas após ${novoStatusPedido}.`);
                });
            } catch (transError) {
                logger.error("Erro na transação de estorno/cancelamento do pedido:", transError);
                res.status(500).send('Erro na transação de estorno.');
                return;
            }
        }

        // Pós-pagamento (apenas na transição efetiva para pago). Executado após a transação
        // para não atrasar nem arriscar o processamento financeiro.
        if (deveNotificar) {
            const tituloEvento = dadosPedido.eventTitle || 'o evento';
            if (isOverbooked) {
                // Resolução automática de overbooking: reembolsa o pagamento. O webhook de
                // estorno (status 'refunded') cuidará de devolver o estoque e remover as inscrições.
                // POLÍTICA: se QUALQUER lote do pedido estourou a capacidade, o pedido INTEIRO é
                // reembolsado (refund total), inclusive lotes do mesmo pedido que tinham estoque.
                // É a opção simples e consistente; refund parcial por lote exigiria cálculo de valor
                // por item e ajuste do webhook de 'refunded' para não remover todas as inscrições.
                const reembolsado = await reembolsarPagamentoAutomatico(paymentId);
                if (reembolsado) {
                    await enviarNotificacaoPush(
                        dadosPedido.userId,
                        'Lote esgotado — reembolso em andamento',
                        `O lote de "${tituloEvento}" esgotou antes da confirmação. Seu pagamento está sendo reembolsado automaticamente.`,
                        '/profile'
                    );
                } else {
                    await enviarNotificacaoPush(
                        dadosPedido.userId,
                        'Problema com seu ingresso',
                        `Houve um problema de disponibilidade em "${tituloEvento}". Entre em contato com o organizador.`,
                        '/profile'
                    );
                }
            } else {
                await enviarNotificacaoPush(
                    dadosPedido.userId,
                    'Ingresso confirmado! 🎟️',
                    `Seu ingresso para ${tituloEvento} foi confirmado. Toque para visualizar.`,
                    dadosPedido.eventId ? `/event/${dadosPedido.eventId}` : '/profile'
                );
            }
        }

        res.status(200).send('Webhook processado.');

    } catch (error) {
        logger.error('Erro ao processar webhook:', error);
        res.status(500).send('Erro interno do servidor.');
    }
});

exports.adminResetPassword = onCall({ cors: true }, async (request) => {
    const data = request.data;
    const { uid, newPassword } = data;
    
    // 1. Verificar se quem está chamando está autenticado
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Apenas usuários autenticados podem redefinir senhas.');
    }
    
    // 2. Verificar se o solicitante é um dos administradores permitidos (claims de admin ou fallback de e-mail)
    const callerEmail = request.auth.token.email || '';
    if (!isCallerAdmin(request.auth.token)) {
        throw new HttpsError('permission-denied', 'Apenas administradores podem redefinir senhas de parceiros.');
    }
    
    if (!uid || !newPassword) {
        throw new HttpsError('invalid-argument', 'UID e nova senha são obrigatórios.');
    }

    // Rate Limiting: 3 resets por 5 minutos por admin
    const rlAdmin = await checkRateLimit(request.auth.uid, 'adminResetPassword', LIMITS.ADMIN_RESET.max, LIMITS.ADMIN_RESET.windowSec);
    if (!rlAdmin.allowed) {
        throw new HttpsError('resource-exhausted', `Limite de resets atingido. Tente novamente em ${Math.ceil(rlAdmin.retryAfterMs / 1000)} segundos.`);
    }
    
    try {
        // 3. Atualizar a senha no Firebase Authentication
        await admin.auth().updateUser(uid, {
            password: newPassword
        });
        
        // 4. Atualizar o perfil no Firestore para exigir mudança no próximo login
        await db.collection('profiles').doc(uid).update({
            mustChangePassword: true
        });
        
        logger.info(`Senha do usuário ${uid} redefinida com sucesso pelo admin ${callerEmail}.`);
        return { success: true };
    } catch (error) {
        logger.error(`Erro ao redefinir senha do usuário ${uid}:`, error);
        throw new HttpsError('internal', 'Erro interno ao redefinir senha.');
    }
});

// Gera um "pagamento Pix confirmado" de teste, produzindo um ingresso real e validável,
// sem cobrar nada nem alterar estoque/faturamento do evento. Exclusivo para administradores.
// Idempotente por (evento, admin): regerar substitui o ingresso de teste anterior em vez de acumular.
exports.criarIngressoTeste = onCall({ cors: true }, async (request) => {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', 'Apenas usuários autenticados podem gerar ingressos de teste.');
    }

    const callerEmail = request.auth.token.email || '';
    if (!isCallerAdmin(request.auth.token)) {
        throw new HttpsError('permission-denied', 'Apenas administradores podem gerar ingressos de teste.');
    }

    const { eventId, itensSelecionados } = request.data || {};
    if (!eventId) {
        throw new HttpsError('invalid-argument', 'O eventId é obrigatório.');
    }

    const uid = request.auth.uid;
    const itens = Array.isArray(itensSelecionados) ? itensSelecionados : [];

    try {
        const eventRef = db.collection('events').doc(eventId);
        const eventDoc = await eventRef.get();
        if (!eventDoc.exists) {
            throw new HttpsError('not-found', 'Evento não encontrado.');
        }
        const eventData = eventDoc.data();
        const ticketsEvento = eventData.tickets || [];

        // Valor e itens calculados no servidor (a partir dos lotes do evento). NÃO altera o estoque.
        let valorTotal = 0;
        const itensComprados = [];
        if (itens.length > 0) {
            for (const item of itens) {
                const qty = Number(item.quantity) || 0;
                if (qty <= 0) continue;
                const ticketReal = ticketsEvento.find(t => t.id === item.id);
                const price = ticketReal ? (Number(ticketReal.price) || 0) : 0;
                const name = ticketReal ? ticketReal.name : (item.name || 'Ingresso');
                valorTotal += price * qty;
                itensComprados.push({ id: item.id, name, quantity: qty });
            }
        } else {
            const precoStr = String(eventData.pixTicketPrice ?? '')
                .replace(/[^\d.,]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.');
            valorTotal = Number(precoStr) || 0;
        }

        const callerName = request.auth.token.name || callerEmail || 'Administrador (Teste)';
        // ID determinístico por (evento, admin): regerar sobrescreve o teste anterior.
        const pedidoId = `TESTE-${eventId}-${uid}`;

        // Remove inscrições do teste anterior deste mesmo pedido (cobre troca de lote).
        const antigasSnap = await db.collection('registrations').where('pedidoId', '==', pedidoId).get();

        const batch = db.batch();
        antigasSnap.docs.forEach(d => batch.delete(d.ref));

        batch.set(db.collection('pedidos').doc(pedidoId), {
            id: pedidoId,
            valor: valorTotal,
            eventId,
            eventTitle: eventData.title || '',
            userId: uid,
            clienteNome: callerName,
            clienteEmail: callerEmail,
            status: 'pago',
            isTeste: true,
            itensComprados: itensComprados.length ? itensComprados : null,
            dataCriacao: FieldValue.serverTimestamp(),
            dataPagamento: FieldValue.serverTimestamp(),
        });

        const baseReg = {
            eventId,
            userId: uid,
            userName: callerName,
            userEmail: callerEmail,
            userPhone: '',
            userCpf: '',
            paymentStatus: 'Pago (Teste)',
            isTeste: true,
            pedidoId,
            timestamp: new Date().toISOString(),
        };

        const registrations = [];
        if (itensComprados.length > 0) {
            for (const item of itensComprados) {
                for (let q = 0; q < item.quantity; q++) {
                    const registrationId = `regteste_${eventId}_${uid}_${item.id}_${q}`;
                    const regData = { ...baseReg, id: registrationId, ticketTypeId: item.id, ticketTypeName: item.name };
                    batch.set(db.collection('registrations').doc(registrationId), regData);
                    registrations.push(regData);
                }
            }
        } else {
            const registrationId = `regteste_${eventId}_${uid}`;
            const regData = { ...baseReg, id: registrationId };
            batch.set(db.collection('registrations').doc(registrationId), regData);
            registrations.push(regData);
        }

        await batch.commit();

        logger.info(`Ingresso(s) de teste gerado(s) por ${callerEmail} no evento ${eventId}: ${registrations.length}.`);
        return { success: true, pedidoId, registrations };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        logger.error('Erro ao criar ingresso de teste:', error);
        throw new HttpsError('internal', 'Erro ao criar ingresso de teste.');
    }
});

// Recupera os ingressos do próprio e-mail para acesso SEM conta no app (compra Pix
// sem login). Resolve o caso em que o comprador fecha a aba antes da confirmação:
// ele entra em /ingresso, recebe um link mágico (email-link) no e-mail da compra e,
// ao clicar, autentica-se com o e-mail VERIFICADO — provando posse da caixa de entrada.
//
// SEGURANÇA: o e-mail vem do TOKEN autenticado (request.auth.token), NÃO de um campo
// enviado pelo cliente. Sem acessar o inbox não há como puxar os ingressos de alguém,
// o que elimina a enumeração por CPF/e-mail do fluxo antigo. Usa Admin SDK (não afeta
// as security rules). A busca é por userEmailLower (e-mail normalizado em minúsculas).
exports.recuperarMeusIngressos = onCall({ cors: true }, async (request) => {
    // Exige sessão criada via email-link, com e-mail verificado pelo Firebase.
    if (!request.auth || !request.auth.token.email || request.auth.token.email_verified !== true) {
        throw new HttpsError('unauthenticated', 'Confirme o link enviado ao seu e-mail para acessar os ingressos.');
    }

    const emailNorm = String(request.auth.token.email).trim().toLowerCase();

    // Rate limit por UID autenticado (10/min).
    const rl = await checkRateLimit(request.auth.uid, 'recuperarMeusIngressos', LIMITS.RECUPERAR_INGRESSO.max, LIMITS.RECUPERAR_INGRESSO.windowSec);
    if (!rl.allowed) {
        throw new HttpsError('resource-exhausted', `Muitas buscas. Tente novamente em ${Math.ceil(rl.retryAfterMs / 1000)} segundos.`);
    }

    try {
        const regsSnap = await db.collection('registrations').where('userEmailLower', '==', emailNorm).limit(50).get();

        // Cache de eventos já lidos (vários ingressos podem ser do mesmo evento).
        const eventosCache = {};
        const ingressos = [];

        for (const docSnap of regsSnap.docs) {
            const reg = docSnap.data();
            if (reg.isTeste === true) continue; // ingressos de teste não entram na recuperação

            const eventId = reg.eventId;
            if (!eventId) continue;

            if (!(eventId in eventosCache)) {
                const evDoc = await db.collection('events').doc(eventId).get();
                eventosCache[eventId] = evDoc.exists ? evDoc.data() : null;
            }
            const ev = eventosCache[eventId];
            if (!ev) continue; // evento deletado — ignora

            ingressos.push({
                registration: {
                    id: docSnap.id,
                    eventId,
                    userName: reg.userName || '',
                    userCpf: reg.userCpf || '',
                    paymentStatus: reg.paymentStatus || '',
                    ticketTypeName: reg.ticketTypeName || '',
                    checkedIn: reg.checkedIn === true,
                    timestamp: reg.timestamp || '',
                },
                event: {
                    id: eventId,
                    title: ev.title || '',
                    date: ev.date || '',
                    time: ev.time || '',
                    location: ev.location || '',
                    address: ev.address || '',
                },
            });
        }

        // Próximos/recentes primeiro (por data do evento, desc).
        ingressos.sort((a, b) => String(b.event.date).localeCompare(String(a.event.date)));

        logger.info(`Recuperação por e-mail retornou ${ingressos.length} ingresso(s).`);
        return { ingressos };
    } catch (error) {
        logger.error('Erro ao recuperar ingressos por e-mail:', error);
        throw new HttpsError('internal', 'Erro ao buscar ingressos.');
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cadastro do organizador como recebedor no Asaas (subconta + walletId)
// ─────────────────────────────────────────────────────────────────────────────

// `creatorId` é o mesmo id gravado em `events.creatorId` (doc de perfil, cujo id é o UID
// do Auth). Confirmar a posse é o ponto crítico: sem isso um parceiro cadastraria a própria
// conta bancária no lugar de outro organizador e desviaria as vendas dele.
async function assertCreatorId(auth, creatorIdPedido) {
    const uid = auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'É preciso estar logado.');

    const creatorId = String(creatorIdPedido || uid);
    if (creatorId === uid || isCallerAdmin(auth.token)) return creatorId;

    const perfilSnap = await db.collection('profiles').doc(creatorId).get();
    const emailPerfil = ((perfilSnap.exists && perfilSnap.data().email) || '').toLowerCase();
    const emailToken = (auth.token.email || '').toLowerCase();
    if (emailPerfil && emailToken && emailPerfil === emailToken) return creatorId;

    throw new HttpsError('permission-denied', 'Você não pode alterar a conta de recebimento deste organizador.');
}

/**
 * Cria a subconta do organizador no Asaas e guarda o `walletId` — é ele, e não o id da
 * conta, que o split usa como destino do repasse.
 *
 * Substitui o antigo fluxo OAuth do Mercado Pago: em vez de redirecionar o organizador
 * para autorizar, recebemos os dados cadastrais dele e criamos a subconta.
 */
exports.asaasCadastrarRecebedor = onCall({ cors: true, secrets: [ASAAS_API_KEY] }, async (request) => {
    const creatorId = await assertCreatorId(request.auth, request.data?.creatorId);

    // Regra de negócio no limite de confiança: só perfil profissional vende com
    // repasse. A UI esconde o cadastro para perfil pessoal; aqui é o enforcement real.
    // Tipos legados ('atletica'/'estabelecimento') contam como profissional.
    const perfilSnap = await db.collection('profiles').doc(creatorId).get();
    if (!perfilSnap.exists || perfilSnap.data().type === 'user') {
        throw new HttpsError('permission-denied', 'Apenas perfis profissionais podem cadastrar conta de recebimento.');
    }

    const d = request.data || {};
    const cpfCnpj = String(d.cpfCnpj || '').replace(/\D/g, '');
    const mobilePhone = String(d.mobilePhone || '').replace(/\D/g, '');
    const cep = String(d.postalCode || '').replace(/\D/g, '');

    // Validação no limite de confiança: os dados vêm do cliente e viram cadastro fiscal
    // e destino de dinheiro. Melhor recusar aqui do que receber 400 genérico do Asaas.
    const faltando = [];
    if (!d.name || String(d.name).trim().length < 3) faltando.push('nome');
    if (!d.email || !String(d.email).includes('@')) faltando.push('e-mail');
    if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) faltando.push('CPF/CNPJ');
    if (mobilePhone.length < 10) faltando.push('celular');
    if (cep.length !== 8) faltando.push('CEP');
    if (!d.address) faltando.push('endereço');
    if (!d.addressNumber) faltando.push('número');
    if (!d.province) faltando.push('bairro');
    // Obrigatório no POST /v3/accounts — sem valor plausível o Asaas recusa o cadastro.
    if (!(Number(d.incomeValue) > 0)) faltando.push('faturamento mensal');
    if (faltando.length > 0) {
        throw new HttpsError('invalid-argument', `Preencha corretamente: ${faltando.join(', ')}.`);
    }

    // Recadastrar por cima criaria uma segunda subconta órfã no Asaas com o mesmo CNPJ.
    const jaExiste = await asaas.getRecebedor(creatorId);
    if (jaExiste) {
        throw new HttpsError('already-exists', 'Este organizador já possui uma conta de recebimento.');
    }

    try {
        const conta = await asaas.criarSubconta({
            name: String(d.name).trim(),
            email: String(d.email).trim().toLowerCase(),
            cpfCnpj,
            mobilePhone,
            incomeValue: Number(d.incomeValue),
            address: d.address,
            addressNumber: String(d.addressNumber),
            complement: d.complement || null,
            province: d.province,
            postalCode: cep,
            companyType: d.companyType || undefined,
        });

        await asaas.salvarRecebedor(creatorId, conta, {
            connectedAt: FieldValue.serverTimestamp(),
            connectedBy: request.auth.uid,
        });

        logger.info(`Organizador ${creatorId} cadastrado no Asaas. walletId=${conta.walletId}`);
        return { success: true };
    } catch (e) {
        logger.error(`Falha ao criar subconta Asaas de ${creatorId}:`, e);
        // A mensagem do Asaas costuma ser acionável ("CPF já cadastrado", "CEP inválido").
        throw new HttpsError('failed-precondition', e.message || 'Não foi possível criar a conta de recebimento.');
    }
});

// Status da conexão para a tela do organizador.
exports.asaasStatusRecebedor = onCall({ cors: true }, async (request) => {
    const creatorId = await assertCreatorId(request.auth, request.data?.creatorId);
    const status = await asaas.getStatusPublico(creatorId);
    return { ...status, feePercent: asaas.platformFeePercent() };
});

// Upgrade pessoal → profissional. Fica no backend porque as rules proíbem o dono de
// alterar o próprio `type` (evita auto-promoção a admin); aqui a transição é controlada.
exports.tornarProfissional = onCall({ cors: true }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'É preciso estar logado.');

    const ref = db.collection('profiles').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
        // Conta antiga sem doc de perfil: cria já como profissional.
        await ref.set({
            name: request.auth.token.name || 'Usuário',
            email: request.auth.token.email || '',
            type: 'profissional',
            mustChangePassword: false,
        });
    } else if (snap.data().type === 'user') {
        await ref.update({ type: 'profissional' });
    }
    // Quem já é profissional/admin recebe ok idempotente.
    logger.info(`Perfil ${uid} atualizado para profissional.`);
    return { success: true };
});

// Desvincula o recebedor. Não apaga a subconta no Asaas: o histórico financeiro dela
// precisa continuar existindo — só paramos de rotear split para essa carteira.
exports.asaasDesconectarRecebedor = onCall({ cors: true }, async (request) => {
    const creatorId = await assertCreatorId(request.auth, request.data?.creatorId);
    await asaas.desconectar(creatorId);
    logger.info(`Organizador ${creatorId} desvinculado do recebedor Asaas.`);
    return { success: true };
});

exports.onRegistrationCreated = onDocumentCreated("registrations/{registrationId}", async (event) => {
    const data = event.data.data();
    // Ingressos de teste (gerados por admin) não entram na contagem real de presença.
    if (!data.eventId || data.isTeste === true) return;
    try {
        await db.collection("events").doc(data.eventId).update({
            registrationCount: FieldValue.increment(1)
        });
        logger.info(`Incremented registration count for event ${data.eventId}`);
    } catch (error) {
        logger.error(`Error incrementing registration count for event ${data.eventId}:`, error);
    }
});

exports.onRegistrationDeleted = onDocumentDeleted("registrations/{registrationId}", async (event) => {
    const data = event.data.data();
    // Ingressos de teste nunca incrementaram a contagem — não decrementam ao serem removidos.
    if (!data.eventId || data.isTeste === true) return;
    try {
        await db.collection("events").doc(data.eventId).update({
            registrationCount: FieldValue.increment(-1)
        });
        logger.info(`Decremented registration count for event ${data.eventId}`);
    } catch (error) {
        logger.error(`Error decrementing registration count for event ${data.eventId}:`, error);
    }
});


