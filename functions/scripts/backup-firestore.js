#!/usr/bin/env node
/**
 * Exporta todas as coleções de raiz do Firestore para JSON, um arquivo por coleção.
 *
 * Por que não `gcloud firestore export`: ele só grava em bucket do Google, num formato
 * (LevelDB) que só volta para o Firestore ou para o BigQuery. Um backup que sirva de
 * plano B fora do Google precisa ser legível e importável em qualquer banco: JSON,
 * datas em ISO, referências como caminho.
 *
 * Uso: node scripts/backup-firestore.js <pasta-de-saida>
 * Credencial: GOOGLE_APPLICATION_CREDENTIALS ou ADC (`gcloud auth application-default login`).
 *
 * ponytail: só coleções de raiz; o app não usa subcoleções (conferido em 2026-09-14).
 * Se surgir uma, percorrer `doc.ref.listCollections()` aqui.
 */
const fs = require('node:fs');
const path = require('node:path');

// Timestamp -> ISO, DocumentReference -> { ref }, GeoPoint -> { lat, lng }, bytes -> base64.
// Tudo o mais (string, número, booleano, null, array, mapa) passa como está.
function serializar(valor) {
  if (valor === null || typeof valor !== 'object') return valor;
  if (typeof valor.toDate === 'function') return valor.toDate().toISOString();
  if (typeof valor.path === 'string' && typeof valor.firestore === 'object') return { ref: valor.path };
  if (typeof valor.latitude === 'number' && typeof valor.longitude === 'number') {
    return { lat: valor.latitude, lng: valor.longitude };
  }
  if (valor instanceof Uint8Array) return { bytes: Buffer.from(valor).toString('base64') };
  if (Array.isArray(valor)) return valor.map(serializar);
  const saida = {};
  for (const [chave, v] of Object.entries(valor)) saida[chave] = serializar(v);
  return saida;
}

async function main(destino) {
  const { initializeApp, applicationDefault } = require('firebase-admin/app');
  const { getFirestore } = require('firebase-admin/firestore');
  initializeApp({ credential: applicationDefault() });
  const db = getFirestore();

  fs.mkdirSync(destino, { recursive: true });
  let total = 0;
  for (const colecao of await db.listCollections()) {
    const snap = await colecao.get();
    const docs = {};
    for (const d of snap.docs) docs[d.id] = serializar(d.data());
    fs.writeFileSync(path.join(destino, `${colecao.id}.json`), JSON.stringify(docs, null, 1));
    total += snap.size;
    console.log(`${colecao.id}: ${snap.size} docs`);
  }
  console.log(`total: ${total} docs em ${destino}`);
}

module.exports = { serializar };

if (require.main === module) {
  const destino = process.argv[2];
  if (!destino) {
    console.error('uso: node scripts/backup-firestore.js <pasta-de-saida>');
    process.exit(2);
  }
  main(destino).catch((erro) => {
    console.error(erro);
    process.exit(1);
  });
}
