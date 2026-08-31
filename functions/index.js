const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { checkRateLimit, LIMITS } = require("./rateLimiter");
const { isCallerAdmin } = require("./adminEmails");
const { handleOgPreview } = require("./ogPreview");
const { getTomorrowDateString, processarLembretesD1 } = require("./reminders");
const { enviarEmailResetSenha } = require("./email");

admin.initializeApp();
const db = admin.firestore();

// Chave do Resend e remetente, usados pelos e-mails transacionais escritos por nós.
// Via Secret Manager (o deploy não sobe functions/.env); localmente caem no functions/.env.
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const EMAIL_FROM = defineSecret("EMAIL_FROM");

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

exports.adminResetPassword = onCall({ cors: true, enforceAppCheck: true }, async (request) => {
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

// Gera um ingresso de teste real e validável (para exercitar a portaria/validação),
// sem cobrar nada nem alterar estoque/faturamento do evento. Exclusivo para administradores.
// Idempotente por (evento, admin): regerar substitui o ingresso de teste anterior em vez de acumular.
exports.criarIngressoTeste = onCall({ cors: true, enforceAppCheck: true }, async (request) => {
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

// Upgrade pessoal → profissional. Fica no backend porque as rules proíbem o dono de
// alterar o próprio `type` (evita auto-promoção a admin); aqui a transição é controlada.
exports.tornarProfissional = onCall({ cors: true, enforceAppCheck: true }, async (request) => {
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

exports.onRegistrationCreated = onDocumentCreated("registrations/{registrationId}", async (event) => {
    const data = event.data?.data() || {};
    // Ingressos de teste (gerados por admin) não entram na contagem real de presença.
    if (!data.eventId || data.isTeste === true) return;
    // Intenção de compra via WhatsApp não conta como confirmado — só entra quando o
    // vendedor confirmar o pagamento (onRegistrationConfirmed).
    if (data.paymentStatus === 'Aguardando pagamento') return;
    try {
        const updates = { registrationCount: FieldValue.increment(1) };
        // Venda manual do organizador (sem pedidoId): o contador de lote é ajustado
        // aqui, pelo Admin SDK — soldByTicket é bloqueado para escrita do cliente.
        // Compras Pix (com pedidoId) já são contabilizadas na transação do webhook.
        if (data.ticketTypeId && !data.pedidoId) {
            updates[`soldByTicket.${data.ticketTypeId}`] = FieldValue.increment(1);
        }
        await db.collection("events").doc(data.eventId).update(updates);
        logger.info(`Incremented registration count for event ${data.eventId}`);
    } catch (error) {
        logger.error(`Error incrementing registration count for event ${data.eventId}:`, error);
    }

    // Notificação push imediata para confirmação de presença gratuita (compras PIX já recebem no webhook)
    if (data.userId && (data.paymentStatus === 'Gratuito' || !data.paymentStatus)) {
        try {
            const eventDoc = await db.collection("events").doc(data.eventId).get();
            const eventTitle = eventDoc.exists ? (eventDoc.data()?.title || 'o evento') : 'o evento';
            await enviarNotificacaoPush(
                data.userId,
                'Vaga confirmada! 🎉',
                `Sua presença em "${eventTitle}" foi confirmada com sucesso.`,
                `/event/${data.eventId}`
            );
        } catch (pushErr) {
            logger.error(`Erro ao enviar push de confirmação gratuita para ${data.userId}:`, pushErr);
        }
    }
});

exports.onRegistrationDeleted = onDocumentDeleted("registrations/{registrationId}", async (event) => {
    const data = event.data?.data() || {};
    // Ingressos de teste nunca incrementaram a contagem — não decrementam ao serem removidos.
    if (!data.eventId || data.isTeste === true) return;
    // Intenção WhatsApp removida ("Remover da lista"): nunca foi contada — não decrementa.
    if (data.paymentStatus === 'Aguardando pagamento') return;
    try {
        const updates = { registrationCount: FieldValue.increment(-1) };
        // Simétrico ao onRegistrationCreated: só vendas manuais (sem pedidoId);
        // estornos de Pix devolvem estoque na transação do webhook.
        if (data.ticketTypeId && !data.pedidoId) {
            updates[`soldByTicket.${data.ticketTypeId}`] = FieldValue.increment(-1);
        }
        await db.collection("events").doc(data.eventId).update(updates);
        logger.info(`Decremented registration count for event ${data.eventId}`);
    } catch (error) {
        logger.error(`Error decrementing registration count for event ${data.eventId}:`, error);
    }
});

// Vendedor confirmou o pagamento de uma intenção WhatsApp ('Aguardando pagamento' →
// 'Pago (WhatsApp)'): agora sim entra na contagem de confirmados, e o comprador é avisado.
exports.onRegistrationConfirmed = onDocumentUpdated("registrations/{registrationId}", async (event) => {
    const before = event.data?.before?.data() || {};
    const after = event.data?.after?.data() || {};
    if (!after.eventId || after.isTeste === true) return;
    // Invariante (espelha onRegistrationCreated/Deleted): o doc conta em
    // registrationCount enquanto NÃO estiver 'Aguardando pagamento'. Contar a
    // transição nos DOIS sentidos mantém a simetria mesmo se um admin alternar o
    // status — sem isso, idas e voltas duplicariam a contagem.
    const eraPendente = before.paymentStatus === 'Aguardando pagamento';
    const ficouPendente = after.paymentStatus === 'Aguardando pagamento';
    if (eraPendente === ficouPendente) return;
    try {
        await db.collection("events").doc(after.eventId).update({ registrationCount: FieldValue.increment(ficouPendente ? -1 : 1) });
    } catch (error) {
        logger.error(`Error updating registration count for event ${after.eventId}:`, error);
    }
    if (!ficouPendente && after.userId) {
        try {
            const eventDoc = await db.collection("events").doc(after.eventId).get();
            const eventTitle = eventDoc.exists ? (eventDoc.data()?.title || 'o evento') : 'o evento';
            await enviarNotificacaoPush(
                after.userId,
                'Pagamento confirmado! 🎟️',
                `Seu ingresso para "${eventTitle}" já está disponível no seu perfil.`,
                `/event/${after.eventId}`
            );
        } catch (pushErr) {
            logger.error(`Erro ao enviar push de confirmação WhatsApp para ${after.userId}:`, pushErr);
        }
    }
});

// Renderizador de Open Graph / WhatsApp Preview para links /e/:id
exports.renderEventOpenGraph = onRequest({ cors: true }, async (req, res) => {
    await handleOgPreview(req, res, db);
});

// Lembrete D-1: dispara diariamente às 09:00 BRT
exports.lembreteEventosD1 = onSchedule({
    schedule: "0 9 * * *",
    timeZone: "America/Sao_Paulo"
}, async () => {
    const tomorrow = getTomorrowDateString(new Date(), "America/Sao_Paulo");
    await processarLembretesD1(db, tomorrow, enviarNotificacaoPush);
});




// Reset de senha, fluxo próprio: geramos o link no servidor com o Admin SDK, extraímos
// o oobCode e o remontamos sobre /auth/action do próprio app (template e tela nossos,
// já que o Google recusa personalizar os deste projeto). O e-mail sai pelo Resend.
// Responde SEMPRE neutro ({ ok: true }) — conta inexistente, e-mail inválido ou rate
// limit não se distinguem de um envio feito, para não permitir enumeração de contas.
// Requer RESEND_API_KEY + EMAIL_FROM (Secret Manager) e domínio verificado no Resend.
exports.solicitarResetSenha = onCall({ cors: true, enforceAppCheck: true, secrets: [RESEND_API_KEY, EMAIL_FROM] }, async (request) => {
    const emailBruto = request.data?.email;
    const email = String(emailBruto || '').trim().toLowerCase();

    // Validação de formato só para evitar trabalho inútil — o retorno é neutro igual.
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: true };
    }

    // Rate limit pelo próprio e-mail: impede usar o endpoint para inundar a caixa
    // de alguém. Estourar o limite também responde neutro, para não vazar nada.
    const rl = await checkRateLimit(email, 'solicitarResetSenha', LIMITS.RESET_SENHA.max, LIMITS.RESET_SENHA.windowSec);
    if (!rl.allowed) {
        logger.warn(`Rate limit de reset de senha atingido para ${email}.`);
        return { ok: true };
    }

    try {
        // Lança auth/user-not-found quando a conta não existe — tratado abaixo.
        const linkFirebase = await admin.auth().generatePasswordResetLink(email);

        // O link nativo aponta para o handler do Firebase. O token é o mesmo; só
        // trocamos o destino para a nossa página, que valida o código pelo SDK
        // (verifyPasswordResetCode NÃO consome — scanner de e-mail não queima o link).
        const oobCode = new URL(linkFirebase).searchParams.get('oobCode');
        if (!oobCode) throw new Error('generatePasswordResetLink devolveu link sem oobCode.');

        const baseUrl = (process.env.APP_BASE_URL || 'https://atchei.app.br').replace(/\/$/, '');
        const link = `${baseUrl}/auth/action?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}`;

        await enviarEmailResetSenha(email, link);
    } catch (error) {
        // Conta inexistente é caso esperado: silencia para não permitir enumeração.
        if (error?.code === 'auth/user-not-found') {
            logger.info(`Reset pedido para e-mail sem conta (${email}). Nada enviado.`);
        } else {
            logger.error(`Falha ao enviar reset de senha para ${email}:`, error);
        }
    }

    return { ok: true };
});
