/**
 * Cliente HTTP do Asaas (API v3) + cofre dos recebedores.
 *
 * TODA chamada ao Asaas passa por aqui de propósito: endpoints, nomes de campos e formato
 * de resposta ficam num arquivo só, fáceis de conferir contra a documentação e de corrigir
 * sem caçar string espalhada pelo index.js.
 *
 * Modelo de split adotado (o padrão de marketplace do Asaas):
 *   • a cobrança é criada com a chave DA PLATAFORMA — a cobrança é nossa;
 *   • o array `split` manda a parte do organizador para o `walletId` dele;
 *   • o que não é distribuído fica na conta da plataforma (nossa comissão).
 *
 * Consequência boa: o webhook chega sempre na NOSSA conta e é lido com a NOSSA chave.
 * Não existe "achar o token do vendedor" como havia no Mercado Pago.
 */
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");
const { FieldValue } = require("firebase-admin/firestore");

const ACCOUNTS = "asaasAccounts";

// Sandbox por padrão: um deploy com env incompleto falha para o lado de NÃO cobrar de verdade.
const DEFAULT_BASE_URL = "https://api-sandbox.asaas.com/v3";

const db = () => admin.firestore();

const baseUrl = () => (process.env.ASAAS_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
const apiKey = () => process.env.ASAAS_API_KEY || "";

/**
 * Chamada crua à API do Asaas. Autenticação é o header `access_token` (não é Bearer).
 * Lança Error com a mensagem devolvida pelo Asaas — o chamador traduz para HttpsError.
 */
async function asaasFetch(path, { method = "GET", body } = {}) {
  const key = apiKey();
  if (!key) {
    throw new Error("ASAAS_API_KEY não configurada no ambiente das functions.");
  }

  const resp = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      access_token: key,
      "Content-Type": "application/json",
      accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const texto = await resp.text();
  let dados = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = null;
  }

  if (!resp.ok) {
    // O Asaas devolve { errors: [{ code, description }] }.
    const detalhe = dados?.errors?.map((e) => e.description).join("; ") || texto || resp.statusText;
    logger.error(`Asaas ${method} ${path} respondeu ${resp.status}: ${detalhe}`);
    const err = new Error(detalhe);
    err.status = resp.status;
    throw err;
  }

  return dados;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recebedores (subcontas)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria a subconta do organizador. O que interessa da resposta é o `walletId`:
 * é ele, e não o id da conta, que o split usa como destino.
 *
 * A resposta também traz a chave da subconta em `accessToken.apiKey` (devolvida uma única
 * vez). NÃO guardamos: no modelo de split a cobrança sai pela chave da plataforma, então
 * essa credencial nunca seria usada — e credencial guardada sem uso é só superfície de
 * vazamento.
 */
async function criarSubconta(dados) {
  const conta = await asaasFetch("/accounts", { method: "POST", body: dados });
  return {
    accountId: conta.id,
    walletId: conta.walletId,
    // `accessToken.apiKey` deliberadamente descartada (ver comentário acima).
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Clientes (pagadores) e cobranças
// ─────────────────────────────────────────────────────────────────────────────

/**
 * O Asaas exige um `customer` na cobrança — não aceita os dados do pagador inline como
 * o Mercado Pago aceitava. Reaproveita o cliente existente pelo CPF/CNPJ para não
 * multiplicar cadastros do mesmo comprador a cada compra.
 */
async function buscarOuCriarCliente({ name, cpfCnpj, email, mobilePhone }) {
  const doc = (cpfCnpj || "").replace(/\D/g, "");
  if (doc) {
    const achados = await asaasFetch(`/customers?cpfCnpj=${encodeURIComponent(doc)}&limit=1`);
    const existente = achados?.data?.[0];
    if (existente?.id) return existente.id;
  }

  const novo = await asaasFetch("/customers", {
    method: "POST",
    body: { name, cpfCnpj: doc, email, mobilePhone: (mobilePhone || "").replace(/\D/g, "") },
  });
  return novo.id;
}

/** Data de vencimento no formato exigido pelo Asaas (YYYY-MM-DD), fuso de São Paulo. */
function vencimentoHoje() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function criarCobrancaPix({ customer, value, description, externalReference, split }) {
  const body = {
    customer,
    billingType: "PIX",
    value,
    dueDate: vencimentoHoje(),
    description,
    externalReference,
  };
  if (split && split.length > 0) body.split = split;
  return asaasFetch("/payments", { method: "POST", body });
}

/**
 * O QR Code do Pix é uma SEGUNDA chamada no Asaas — o POST /payments não devolve o QR
 * junto, ao contrário do Mercado Pago. Devolve já no formato que o frontend consome.
 */
async function obterQrCodePix(paymentId) {
  const qr = await asaasFetch(`/payments/${paymentId}/pixQrCode`);
  return {
    qr_code: qr.payload,           // copia-e-cola
    qr_code_base64: qr.encodedImage, // imagem base64
    expiracao: qr.expirationDate || null,
  };
}

/**
 * Reconsulta a cobrança na API. O webhook depende disto: como o Asaas não assina o
 * payload (só manda um token estático), o status confiável é o que a API responde,
 * não o que veio no corpo da requisição.
 */
const consultarCobranca = (paymentId) => asaasFetch(`/payments/${paymentId}`);

const estornarCobranca = (paymentId) =>
  asaasFetch(`/payments/${paymentId}/refund`, { method: "POST" });

// ─────────────────────────────────────────────────────────────────────────────
// Dinheiro
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reparte o valor entre plataforma e organizador.
 *
 * Atenção à inversão em relação ao Mercado Pago: lá declarávamos a NOSSA comissão
 * (`application_fee`); aqui declaramos quanto vai para o ORGANIZADOR, e a diferença
 * é que fica conosco.
 *
 * Usa `percentualValue`, NÃO `fixedValue`. Motivo: o Asaas valida o split contra o
 * `netValue` (bruto menos a tarifa dele), que só é conhecido depois da cobrança criada.
 * Um `fixedValue` calculado sobre o bruto estoura esse teto sempre que a comissão da
 * plataforma for menor que a tarifa do Asaas — numa venda de R$ 50 com comissão de 0%,
 * pedir repasse de R$ 50 contra um líquido de ~R$ 48 faz o Asaas recusar a cobrança.
 * O percentual é limitado a 100% por definição e nunca cai nessa armadilha.
 *
 * Efeito colateral aceito: a tarifa do Asaas passa a ser rateada entre os dois na mesma
 * proporção, em vez de ser absorvida só pela plataforma.
 *
 * Os valores em reais devolvidos são ESTIMATIVAS sobre o bruto, para exibição no painel.
 * O valor exato repassado vem no `netValue` do webhook.
 */
function calcSplit(valorTotal, feePercent) {
  const valor = Math.round(Number(valorTotal) * 100) / 100;
  const pct = Number(feePercent);

  const vazio = { percentualOrganizador: 0, feeEstimada: 0, repasseEstimado: 0 };
  if (!(valor > 0)) return vazio;

  const feePct = Math.min(Math.max(pct > 0 ? pct : 0, 0), 100);
  // O Asaas aceita até 4 casas decimais no percentual.
  const percentualOrganizador = Math.round((100 - feePct) * 10000) / 10000;
  if (!(percentualOrganizador > 0)) return vazio; // comissão de 100%: não há repasse

  const feeEstimada = Math.round(valor * feePct) / 100;
  const repasseEstimado = Math.round((valor - feeEstimada) * 100) / 100;
  return { percentualOrganizador, feeEstimada, repasseEstimado };
}

const platformFeePercent = () => Number(process.env.PLATFORM_FEE_PERCENT || 0);

// ─────────────────────────────────────────────────────────────────────────────
// Cofre: asaasAccounts/{creatorId}
// ─────────────────────────────────────────────────────────────────────────────

async function salvarRecebedor(creatorId, { accountId, walletId }, meta = {}) {
  await db().collection(ACCOUNTS).doc(creatorId).set(
    { creatorId, accountId, walletId, updatedAt: FieldValue.serverTimestamp(), ...meta },
    { merge: true }
  );
}

async function getRecebedor(creatorId) {
  if (!creatorId) return null;
  const snap = await db().collection(ACCOUNTS).doc(creatorId).get();
  if (!snap.exists) return null;
  const dados = snap.data();
  return dados.walletId ? dados : null;
}

async function getStatusPublico(creatorId) {
  const rec = await getRecebedor(creatorId);
  if (!rec) return { connected: false };
  // Só o que é seguro exibir. accountId/walletId não são segredo, mas também não
  // servem ao frontend — não vazam por não terem motivo para sair.
  return {
    connected: true,
    connectedAt: rec.connectedAt ? rec.connectedAt.toMillis?.() ?? null : null,
  };
}

const desconectar = (creatorId) => db().collection(ACCOUNTS).doc(creatorId).delete();

module.exports = {
  ACCOUNTS,
  asaasFetch,
  criarSubconta,
  buscarOuCriarCliente,
  criarCobrancaPix,
  obterQrCodePix,
  consultarCobranca,
  estornarCobranca,
  calcSplit,
  platformFeePercent,
  salvarRecebedor,
  getRecebedor,
  getStatusPublico,
  desconectar,
};
