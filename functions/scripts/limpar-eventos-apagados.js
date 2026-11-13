/**
 * Uso único (auditoria de 13/11, achado A1): eventos apagados ANTES da function
 * onEventDeleted deixaram inscrições órfãs e não têm lápide em deletedEvents — quem
 * recriasse um desses ids viraria "dono" das inscrições. Este script faz, para cada
 * eventId órfão, o que a onEventDeleted passou a fazer: grava a lápide e apaga as
 * inscrições.
 *
 * Sem argumento só lista (nada é gravado). Com --aplicar, grava.
 *   GOOGLE_APPLICATION_CREDENTIALS=<chave.json> node functions/scripts/limpar-eventos-apagados.js [--aplicar]
 */
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const aplicar = process.argv.includes('--aplicar');

(async () => {
    const regs = await db.collection('registrations').get();
    const porEvento = new Map();
    for (const r of regs.docs) {
        const id = r.get('eventId');
        if (typeof id !== 'string' || !id) continue;
        if (!porEvento.has(id)) porEvento.set(id, []);
        porEvento.get(id).push(r.ref);
    }

    const ids = [...porEvento.keys()];
    const eventos = ids.length ? await db.getAll(...ids.map(id => db.collection('events').doc(id))) : [];
    const orfaos = ids.filter((_, i) => !eventos[i].exists);

    for (const id of orfaos) {
        const refs = porEvento.get(id);
        console.log(`${aplicar ? 'limpando' : 'órfão'}: evento ${id}, ${refs.length} inscrição(ões)`);
        if (!aplicar) continue;
        await db.collection('deletedEvents').doc(id).set({ deletedAt: FieldValue.serverTimestamp() });
        for (let i = 0; i < refs.length; i += 450) {
            const batch = db.batch();
            refs.slice(i, i + 450).forEach(ref => batch.delete(ref));
            await batch.commit();
        }
    }
    console.log(`${orfaos.length} evento(s) órfão(s) de ${ids.length} com inscrição.${aplicar ? '' : ' Nada gravado (use --aplicar).'}`);
})().catch((e) => { console.error(e); process.exit(1); });
