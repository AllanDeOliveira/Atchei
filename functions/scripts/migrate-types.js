/**
 * Migração única: perfis com os tipos legados 'atletica' e 'estabelecimento'
 * viram 'profissional' (os tipos foram fundidos).
 *
 * Requisitos: mesmos do set-admins.js (GOOGLE_APPLICATION_CREDENTIALS).
 * Execução (a partir da raiz do repositório):
 * node functions/scripts/migrate-types.js
 */

const admin = require('firebase-admin');

try {
  // projectId explícito: as credenciais padrão da máquina podem apontar para outro projeto.
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'atchei' });
  console.log('Firebase Admin SDK inicializado via Application Default Credentials.');
} catch (e) {
  console.error('Erro ao inicializar o Firebase Admin. Defina GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

async function migrate() {
  const db = admin.firestore();
  const snap = await db.collection('profiles').where('type', 'in', ['atletica', 'estabelecimento']).get();

  if (snap.empty) {
    console.log('Nenhum perfil legado encontrado. Nada a migrar.');
    return;
  }

  console.log(`Migrando ${snap.size} perfil(is) para type: 'profissional'...`);
  const batch = db.batch();
  snap.docs.forEach((doc) => {
    console.log(`  ➔ ${doc.id} (${doc.data().name || 'sem nome'}) [${doc.data().type}]`);
    batch.update(doc.ref, { type: 'profissional' });
  });
  await batch.commit();
  console.log('Migração concluída.');
}

migrate().catch((e) => {
  console.error('Falha na migração:', e);
  process.exit(1);
});
