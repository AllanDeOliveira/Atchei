// Testa as rules no emulador do Firestore via REST, com contas fictícias (nada toca produção).
// Os casos de ataque vêm da auditoria de 13/11; numa versão vulnerável, eles falham.
//   1) java -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-*.jar
//        --host 127.0.0.1 --port 8089 --project_id demo-atchei --rules firebase/firestore.rules
//      (o jar baixa com `firebase setup:emulators:firestore`; precisa de Java)
//   2) node firebase/rules-check.mjs
// Reinicie o emulador entre execuções: um 500 de avaliação deixa lock preso no doc.
const BASE = 'http://127.0.0.1:8089/v1/projects/demo-atchei/databases/(default)/documents';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (uid, extra = {}) => {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
    iss: 'https://securetoken.google.com/demo-atchei', aud: 'demo-atchei',
    sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now,
    email: `${uid}@example.invalid`, email_verified: true,
    firebase: { sign_in_provider: 'password', identities: {} }, ...extra,
  })}.`;
};

const val = (v) => {
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (Number.isInteger(v)) return { integerValue: String(v) };
  return { mapValue: { fields: fields(v) } };
};
const fields = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, val(v)]));

// 'owner' = bypass de rules; 'anon' = sem login; 'admin' = claim admin; resto = uid comum.
const headers = (uid) => ({
  'Content-Type': 'application/json',
  ...(uid === 'anon' ? {} : { Authorization: `Bearer ${uid === 'owner' ? 'owner' : token(uid, uid === 'admin' ? { admin: true } : {})}` }),
});
async function call(method, path, uid, body, query = '') {
  const r = await fetch(`${BASE}/${path}${query}`, {
    method, headers: headers(uid),
    body: body ? JSON.stringify({ fields: fields(body) }) : undefined,
  });
  if (![200, 403, 500].includes(r.status)) console.log('   corpo:', (await r.text()).slice(0, 400));
  return r.status;
}
// Sem id = id aleatório de 20 caracteres, como o addDoc (o emulador dá 500 no auto-id via REST com rules).
const autoId = () => Array.from({ length: 20 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]).join('');
const create = (coll, id, uid, data) =>
  call('POST', coll, uid, data, `?documentId=${encodeURIComponent(id || autoId())}`);
const update = (path, uid, data) =>
  call('PATCH', path, uid, data, '?' + Object.keys(data).map(k => `updateMask.fieldPaths=${k}`).join('&') + '&currentDocument.exists=true');
const get = (path, uid) => call('GET', path, uid);
// Vários creates num batch atômico (como o writeBatch do cliente): [[coleção, id, dados], ...].
const DOCS = 'projects/demo-atchei/databases/(default)/documents';
async function commit(uid, writes) {
  const r = await fetch(`${BASE}:commit`, { method: 'POST', headers: headers(uid), body: JSON.stringify({
    writes: writes.map(([c, id, data]) => ({ update: { name: `${DOCS}/${c}/${id}`, fields: fields(data) }, currentDocument: { exists: false } })) }) });
  return r.status;
}
// Query de coleção, com um filtro de igualdade opcional [campo, valor].
async function listar(coll, uid, filtro) {
  const where = filtro && { fieldFilter: { field: { fieldPath: filtro[0] }, op: 'EQUAL', value: val(filtro[1]) } };
  const r = await fetch(`${BASE}:runQuery`, { method: 'POST', headers: headers(uid), body: JSON.stringify({
    structuredQuery: { from: [{ collectionId: coll }], ...(where ? { where } : {}) } }) });
  return r.status;
}

let falhas = 0;
async function espera(nome, esperado, p) {
  const st = await p;
  // 'erro': a rule falha na avaliação (campo ausente), o que em produção é negado; o emulador responde 500.
  const ok = esperado === 'allow' ? st === 200 : esperado === 'erro' ? st === 500 : st === 403;
  if (!ok) falhas++;
  console.log(`${ok ? 'ok  ' : 'FALHOU'} ${esperado.padEnd(5)} ${st} ${nome}`);
}

await fetch('http://127.0.0.1:8089/emulator/v1/projects/demo-atchei/databases/(default)/documents', { method: 'DELETE' });

// Semente (bypass de rules)
const ev = { title: 'Evento', hasPresence: true, hasTickets: true, date: '2099-01-01' };
await create('events', 'ev1', 'owner', { ...ev, creatorId: 'dono' });
await create('events', 'evX', 'owner', { ...ev, creatorId: 'outro' });
await create('events', 'evCap', 'owner', { ...ev, creatorId: 'outro', maxParticipants: 1, registrationCount: 1 });
await create('deletedEvents', 'apagado', 'owner', { x: true });
await create('registrations', 'ev1_comprador', 'owner', {
  eventId: 'ev1', userId: 'comprador', userName: 'C', paymentStatus: 'Aguardando pagamento', timestamp: 't' });

const reg = (o) => ({ eventId: 'ev1', userName: 'N', timestamp: 't', ...o });

// A1 / A4
await espera('A1 recriar id apagado', 'deny', create('events', 'apagado', 'atacante', { ...ev, creatorId: 'atacante' }));
await espera('A1 evento novo legítimo', 'allow', create('events', 'novo1', 'atacante', { ...ev, creatorId: 'atacante' }));
await espera('A4 create com registrationCount', 'deny', create('events', 'novo2', 'atacante', { ...ev, creatorId: 'atacante', registrationCount: 50000 }));
await espera('A4 create com soldByTicket', 'deny', create('events', 'novo3', 'atacante', { ...ev, creatorId: 'atacante', soldByTicket: { a: 9 } }));
await espera('admin cria evento em nome de parceiro', 'allow', create('events', 'novo4', 'admin', { ...ev, creatorId: 'parceiro' }));

// A2 + unidade adiada
await espera('A2 dono cria inscrição com uid alheio', 'deny', create('registrations', null, 'dono', reg({ userId: 'vitima', paymentStatus: 'Cortesia' })));
await espera('A2 dono cria convidado manual', 'allow', create('registrations', null, 'dono', reg({ userId: 'guest-manual-1731500000000', paymentStatus: 'Cortesia', ticketTypeId: 't1', ticketTypeName: 'Geral', userCpf: '1' })));
await espera('A2 dono em nome próprio', 'allow', create('registrations', null, 'dono', reg({ userId: 'dono', paymentStatus: 'Cortesia' })));
await espera('adiada: dono ocupa evX_vitima', 'deny', create('registrations', 'evX_vitima', 'dono', reg({ userId: 'guest-manual-1', paymentStatus: 'Cortesia' })));
await espera('não-dono não usa caminho A', 'deny', create('registrations', null, 'atacante', reg({ userId: 'guest-manual-1', paymentStatus: 'Cortesia' })));

// A6
await espera('A6 presença com isTeste', 'deny', create('registrations', 'ev1_p1', 'p1', reg({ userId: 'p1', paymentStatus: 'Gratuito', isTeste: true })));
await espera('A6 presença normal', 'allow', create('registrations', 'ev1_p2', 'p2', reg({ userId: 'p2', userEmail: 'e', paymentStatus: 'Gratuito', checkedIn: false })));
await espera('A6 intenção com ticketTypeName', 'deny', create('registrations', 'ev1_p3', 'p3', reg({ userId: 'p3', paymentStatus: 'Aguardando pagamento', ticketTypeName: 'CAMAROTE VIP' })));
await espera('A6 intenção normal', 'allow', create('registrations', 'ev1_p4', 'p4', reg({ userId: 'p4', userEmail: 'e', userPhone: '65999999999', paymentStatus: 'Aguardando pagamento' })));
await espera('presença em evento lotado', 'deny', create('registrations', 'evCap_p5', 'p5', reg({ eventId: 'evCap', userId: 'p5', paymentStatus: 'Gratuito' })));
await espera('presença com ticketTypeId', 'deny', create('registrations', 'ev1_p6', 'p6', reg({ userId: 'p6', paymentStatus: 'Gratuito', ticketTypeId: 'x' })));

// A3
await espera('A3 confirmar sem ticketSecret', 'deny', update('registrations/ev1_comprador', 'dono', { paymentStatus: 'Pago (WhatsApp)' }));
await espera('A3 confirmar com segredo curto', 'deny', update('registrations/ev1_comprador', 'dono', { paymentStatus: 'Pago (WhatsApp)', ticketSecret: 'abc' }));
await espera('A3 terceiro confirma', 'deny', update('registrations/ev1_comprador', 'atacante', { paymentStatus: 'Pago (WhatsApp)', ticketSecret: crypto.randomUUID() }));
await espera('A3 confirmar com ticketSecret', 'allow', update('registrations/ev1_comprador', 'dono', { paymentStatus: 'Pago (WhatsApp)', ticketSecret: crypto.randomUUID() }));
await espera('A3 comprador lê o próprio ingresso', 'allow', get('registrations/ev1_comprador', 'comprador'));
await espera('A3 terceiro não lê o ingresso', 'deny', get('registrations/ev1_comprador', 'atacante'));
await espera('check-in pelo dono segue valendo', 'allow', update('registrations/ev1_comprador', 'dono', { checkedIn: true, checkedInAt: 't', checkedInBy: 'D' }));

// Perfil (A5 + lead 1): público sem e-mail/nascimento; profilesPrivate nasce no mesmo batch.
const perfil = (type = 'profissional') => ({ name: 'A', type, description: '', mustChangePassword: false });
const cadastro = (uid, privado, publico = perfil()) => commit(uid, [['profilesPrivate', uid, privado], ['profiles', uid, publico]]);
await espera('perfil sem o doc privado', 'deny', create('profiles', 'solo', 'solo', perfil()));
await espera('perfil público com e-mail', 'deny', cadastro('pub', { email: 'pub@example.invalid', birthDate: '1990-01-01' }, { ...perfil(), email: 'pub@example.invalid' }));
await espera('privado com e-mail alheio', 'deny', cadastro('atk', { email: 'vitima@example.invalid', birthDate: '1990-01-01' }));
await espera('privado menor de idade', 'deny', cadastro('menor', { email: 'menor@example.invalid', birthDate: '2015-01-01' }));
await espera('privado com campo extra', 'deny', cadastro('extra', { email: 'extra@example.invalid', birthDate: '1990-01-01', cpf: '1' }));
await espera('cadastro válido (e-mail em outra caixa)', 'allow', cadastro('org', { email: 'ORG@example.invalid', birthDate: '1990-01-01' }));
await espera('anônimo lê perfil profissional', 'allow', get('profiles/org', 'anon'));
await espera('anônimo lista profissionais', 'allow', listar('profiles', 'anon', ['type', 'profissional']));
await espera('anônimo lê o privado', 'deny', get('profilesPrivate/org', 'anon'));
await espera('outra conta lê o privado', 'deny', get('profilesPrivate/org', 'atacante'));
await espera('outra conta lista privados', 'deny', listar('profilesPrivate', 'atacante'));
await espera('dono lê o privado', 'allow', get('profilesPrivate/org', 'org'));
await espera('admin lista privados', 'allow', listar('profilesPrivate', 'admin'));
await espera('dono edita nome', 'allow', update('profiles/org', 'org', { name: 'Novo' }));
await espera('dono põe e-mail no público', 'deny', update('profiles/org', 'org', { email: 'org@example.invalid' }));
await espera('dono troca o tipo', 'deny', update('profiles/org', 'org', { type: 'admin' }));
await espera('dono altera o privado', 'deny', update('profilesPrivate/org', 'org', { birthDate: '2000-01-01' }));
await espera('outra conta edita o perfil', 'deny', update('profiles/org', 'atacante', { name: 'X' }));
await espera('evento com creatorId de outra conta', 'deny', create('events', 'novo5', 'atacante', { ...ev, creatorId: 'org' }));

// lápide é invisível ao cliente
await espera('deletedEvents não é legível', 'deny', get('deletedEvents/apagado', 'atacante'));

console.log(falhas ? `${falhas} FALHA(S)` : 'tudo conforme o esperado');
process.exit(falhas ? 1 : 0);
