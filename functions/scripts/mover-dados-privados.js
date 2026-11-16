/**
 * Uso único (A5 da auditoria de 13/11), DEPOIS do deploy das rules novas: move `email` e
 * `birthDate` de profiles/{uid} (público para perfil profissional) para profilesPrivate/{uid}.
 * Antes do deploy, as rules antigas ainda leem profiles.email no update do perfil.
 *
 * Sem argumento só lista (nada é gravado). Com --aplicar, grava.
 *   node functions/scripts/mover-dados-privados.js [--aplicar]   (credencial: ADC ou GOOGLE_APPLICATION_CREDENTIALS)
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault(), projectId: 'atchei' });
const db = getFirestore();
const aplicar = process.argv.includes('--aplicar');

(async () => {
    const perfis = await db.collection('profiles').get();
    let n = 0;
    for (const p of perfis.docs) {
        const { email, birthDate } = p.data();
        if (email === undefined && birthDate === undefined) continue;
        n++;
        console.log(`${aplicar ? 'movendo' : 'mover'}: ${p.id} (${[email !== undefined && 'email', birthDate !== undefined && 'birthDate'].filter(Boolean).join(', ')})`);
        if (!aplicar) continue;
        const privado = { ...(email !== undefined && { email }), ...(birthDate !== undefined && { birthDate }) };
        const batch = db.batch();
        batch.set(db.collection('profilesPrivate').doc(p.id), privado, { merge: true });
        batch.update(p.ref, { email: FieldValue.delete(), birthDate: FieldValue.delete() });
        await batch.commit();
    }
    console.log(`${n} de ${perfis.size} perfil(is) com dado privado.${aplicar ? '' : ' Nada gravado (use --aplicar).'}`);
})().catch((e) => { console.error(e); process.exit(1); });
