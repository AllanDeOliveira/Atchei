/**
 * Migração one-shot: copia tickets[].sold (legado, forjável pelo organizador)
 * para o campo soldByTicket, gerido só pelo backend e protegido nas rules.
 *
 * Idempotente: só grava chaves que ainda não existem em soldByTicket (nunca
 * sobrescreve contagem já mantida pelo webhook/triggers).
 *
 * Requisitos: GOOGLE_APPLICATION_CREDENTIALS apontando para a chave do
 * Service Account (mesmo esquema do set-admins.js).
 *
 * Execução (a partir da raiz): node functions/scripts/migrate-sold.js
 */

const admin = require('firebase-admin');

// projectId explícito: o default do ambiente pode apontar para outro projeto gcloud.
admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'atchei' });
const db = admin.firestore();

(async () => {
  const snapshot = await db.collection('events').get();
  let migrados = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const tickets = data.tickets || [];
    const soldMap = data.soldByTicket || {};

    const updates = {};
    for (const t of tickets) {
      if (t.id && typeof t.sold === 'number' && soldMap[t.id] === undefined) {
        updates[`soldByTicket.${t.id}`] = t.sold;
      }
    }

    if (Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      migrados++;
      console.log(`Evento ${doc.id}: ${Object.keys(updates).length} lote(s) migrado(s).`);
    }
  }

  console.log(`Concluído: ${migrados} de ${snapshot.size} eventos precisaram de migração.`);
  process.exit(0);
})().catch((e) => {
  console.error('Falha na migração:', e);
  process.exit(1);
});
