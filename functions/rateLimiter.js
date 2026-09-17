const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

/**
 * Limites de rate limiting para cada função.
 * Sem setAdminClaim — baixo risco, poucos admins.
 */
const LIMITS = {
  ADMIN_RESET: { max: 3, windowSec: 300 },           // 3 por 5 minutos
  RESET_SENHA: { max: 3, windowSec: 900 },           // 3 pedidos por 15 min por e-mail
  VERIFICACAO_EMAIL: { max: 3, windowSec: 900 },     // 3 reenvios por 15 min por usuário
};

/**
 * Verifica e incrementa o contador de rate limit usando transação Firestore.
 *
 * @param {string} identifier - ID do usuário, IP, etc.
 * @param {string} functionName - Nome da função (chave para distinguir limites).
 * @param {number} maxRequests - Máximo de requisições permitidas na janela.
 * @param {number} windowSeconds - Tamanho da janela em segundos.
 * @param {{failClosed?: boolean}} [opts] - failClosed: em falha de infra NEGA em vez de liberar.
 * @returns {Promise<{allowed: boolean, retryAfterMs: number}>}
 */
async function checkRateLimit(identifier, functionName, maxRequests, windowSeconds, { failClosed = false } = {}) {
  if (!identifier || !functionName) {
    logger.warn("checkRateLimit chamado sem identifier ou functionName. Permitindo por segurança.");
    return { allowed: true, retryAfterMs: 0 };
  }

  const db = getFirestore();
  const docId = `${functionName}_${identifier}`;
  const docRef = db.collection("_rateLimits").doc(docId);
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  try {
    const result = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(docRef);

      if (!doc.exists) {
        // Primeiro request — criar documento
        transaction.set(docRef, {
          count: 1,
          windowStart: now,
          expiresAt: new Date(now + windowMs),
          functionName,
          identifier,
        });
        return { allowed: true, retryAfterMs: 0 };
      }

      const data = doc.data();
      const windowStart = data.windowStart || 0;
      const elapsed = now - windowStart;

      if (elapsed >= windowMs) {
        // Janela expirou — resetar contador
        transaction.update(docRef, {
          count: 1,
          windowStart: now,
          expiresAt: new Date(now + windowMs),
        });
        return { allowed: true, retryAfterMs: 0 };
      }

      const currentCount = data.count || 0;

      if (currentCount >= maxRequests) {
        // Limite atingido
        const retryAfterMs = windowMs - elapsed;
        logger.warn(
          `Rate limit atingido: ${functionName} por ${identifier}. ` +
          `${currentCount}/${maxRequests} em ${Math.round(elapsed / 1000)}s. ` +
          `Tente novamente em ${Math.round(retryAfterMs / 1000)}s.`
        );
        return { allowed: false, retryAfterMs };
      }

      // Incrementar contador
      transaction.update(docRef, {
        count: currentCount + 1,
      });
      return { allowed: true, retryAfterMs: 0 };
    });

    return result;
  } catch (error) {
    // Falha de infra (Firestore): por padrão libera (fail-open) para não travar operação
    // legítima. As rotas que disparam e-mail passam failClosed: negar é mais barato do que
    // deixar inundar a cota do Resend sem contador.
    logger.error(`Erro no checkRateLimit (${failClosed ? "negando" : "permitindo"} requisição):`, error);
    return failClosed ? { allowed: false, retryAfterMs: 60_000 } : { allowed: true, retryAfterMs: 0 };
  }
}

module.exports = { checkRateLimit, LIMITS };
