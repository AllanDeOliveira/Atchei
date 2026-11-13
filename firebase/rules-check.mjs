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

async function call(method, path, uid, body, query = '') {
  const auth = uid === 'owner' ? 'owner' : token(uid, uid === 'admin' ? { admin: true } : {});
  const r = await fetch(`${BASE}/${path}${query}`, {
    method, headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' },
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

// Lead 1 (perfil com e-mail alheio)
const perfil = { name: 'A', type: 'user', birthDate: '1990-01-01' };
await espera('perfil com e-mail alheio', 'deny', create('profiles', 'atk', 'atk', { ...perfil, email: 'vitima@example.invalid' }));
await espera('perfil sem e-mail', 'erro', create('profiles', 'semEmail', 'semEmail', perfil));
await espera('perfil com o próprio e-mail (caixa diferente)', 'allow', create('profiles', 'atk', 'atk', { ...perfil, email: 'ATK@example.invalid' }));
await espera('perfil menor de idade', 'deny', create('profiles', 'menor', 'menor', { ...perfil, birthDate: '2015-01-01', email: 'menor@example.invalid' }));

// lápide é invisível ao cliente
await espera('deletedEvents não é legível', 'deny', get('deletedEvents/apagado', 'atacante'));

console.log(falhas ? `${falhas} FALHA(S)` : 'tudo conforme o esperado');
process.exit(falhas ? 1 : 0);
