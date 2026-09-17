/**
 * Preenche creatorName/creatorImageUrl nos eventos que ainda não têm (criados antes de
 * 2026-09-17). Depois disso a página do evento não precisa ler o perfil do criador:
 * perfil de conta pessoal deixou de ser público nas rules.
 *
 * Execução (raiz do repo, credencial ADC de um owner do projeto):
 *   GOOGLE_CLOUD_QUOTA_PROJECT=atchei node functions/scripts/preencher-criador-eventos.js [--dry-run]
 * Idempotente: só toca evento sem creatorName. Com --dry-run só lista o que faria.
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault(), projectId: 'atchei' });
const db = getFirestore();
const dryRun = process.argv.includes('--dry-run');

(async () => {
  const eventos = await db.collection('events').get();
  const perfis = new Map();
  let preenchidos = 0;
  let semPerfil = 0;

  for (const ev of eventos.docs) {
    const d = ev.data();
    if (d.creatorName) continue;

    if (!perfis.has(d.creatorId)) {
      const p = await db.collection('profiles').doc(d.creatorId).get();
      perfis.set(d.creatorId, p.exists ? p.data() : null);
    }
    const perfil = perfis.get(d.creatorId);
    if (!perfil) {
      semPerfil++;
      console.log(`sem perfil: ${ev.id} (${d.title}) creatorId=${d.creatorId}`);
      continue;
    }

    console.log(`${dryRun ? '[dry-run] ' : ''}${ev.id} (${d.title}) -> ${perfil.name}`);
    if (!dryRun) await ev.ref.update({ creatorName: perfil.name || '', creatorImageUrl: perfil.imageUrl || '' });
    preenchidos++;
  }

  console.log(`\n${eventos.size} eventos; ${preenchidos} ${dryRun ? 'a preencher' : 'preenchidos'}; ${semPerfil} sem perfil.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
