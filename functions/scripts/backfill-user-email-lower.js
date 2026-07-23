/**
 * Backfill de `userEmailLower` nas inscrições - Atchêi
 *
 * A recuperação de ingressos por email-link busca por `userEmailLower` (e-mail
 * normalizado em minúsculas). Inscrições criadas ANTES dessa mudança não têm o
 * campo e ficam invisíveis na recuperação. Este script preenche o campo em toda
 * a coleção `registrations`, derivando de `userEmail`.
 *
 * É IDEMPOTENTE: só escreve nos documentos cujo valor difere do esperado, então
 * pode ser executado quantas vezes precisar sem efeitos colaterais.
 *
 * Requisitos:
 * 1. Arquivo de chave do Firebase Service Account (JSON)
 * 2. Variável de ambiente GOOGLE_APPLICATION_CREDENTIALS apontando para a chave
 * 3. Dependências das functions instaladas (npm install dentro de functions/)
 *
 * Execução (a partir da raiz do repositório):
 * node functions/scripts/backfill-user-email-lower.js
 *
 * Simulação (não escreve nada, só relata o que faria):
 * node functions/scripts/backfill-user-email-lower.js --dry-run
 */

const admin = require('firebase-admin');

const DRY_RUN = process.argv.includes('--dry-run');
const PAGE_SIZE = 400; // abaixo do limite de 500 escritas por batch do Firestore

try {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
  console.log('Firebase Admin SDK inicializado via Application Default Credentials.');
} catch (e) {
  console.error('Erro ao inicializar Firebase Admin com credenciais padrão.');
  console.error('Garanta que a variável GOOGLE_APPLICATION_CREDENTIALS está definida.');
  console.error('Exemplo (PowerShell): $env:GOOGLE_APPLICATION_CREDENTIALS="caminho/para/chave.json"');
  process.exit(1);
}

const db = admin.firestore();

async function backfill() {
  console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}Iniciando backfill de userEmailLower em registrations...\n`);

  let lastDoc = null;
  let scanned = 0;
  let updated = 0;

  // Percorre a coleção em páginas ordenadas por documentId (paginação estável).
  for (;;) {
    let q = db.collection('registrations').orderBy('__name__').limit(PAGE_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    let pending = 0;

    for (const doc of snap.docs) {
      scanned++;
      const data = doc.data();
      const desired = String(data.userEmail || '').trim().toLowerCase();

      // Só atualiza quando o valor difere do esperado (idempotência + menos escritas).
      if (data.userEmailLower === desired) continue;

      if (!DRY_RUN) {
        batch.update(doc.ref, { userEmailLower: desired });
      }
      pending++;
      updated++;
    }

    if (pending > 0 && !DRY_RUN) {
      await batch.commit();
    }

    console.log(`  Página processada: ${snap.size} lidos, ${pending} ${DRY_RUN ? 'seriam atualizados' : 'atualizados'} (total lidos: ${scanned}).`);

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < PAGE_SIZE) break; // última página
  }

  console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}Concluído. ${scanned} inscrições lidas, ${updated} ${DRY_RUN ? 'seriam atualizadas' : 'atualizadas'}.`);
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Erro no backfill:', err);
    process.exit(1);
  });
