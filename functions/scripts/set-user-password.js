/**
 * Define/repõe a senha de um usuário e marca o e-mail como verificado.
 *
 * Útil quando um login por e-mail/senha "some" após o dono entrar com um provedor
 * federado (Google) num e-mail NÃO verificado — o Firebase troca o provedor por
 * segurança. Marcar emailVerified=true faz futuros logins Google LIGAREM (link) em
 * vez de SUBSTITUÍREM o provedor de senha.
 *
 * Requisitos: GOOGLE_APPLICATION_CREDENTIALS apontando para a chave de service account.
 *
 * Uso (a partir da raiz do repo):
 *   node functions/scripts/set-user-password.js <email> <novaSenha>
 */

const admin = require('firebase-admin');

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Uso: node functions/scripts/set-user-password.js <email> <novaSenha>');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });

(async () => {
  const user = await admin.auth().getUserByEmail(email);
  await admin.auth().updateUser(user.uid, { password, emailVerified: true });
  const after = await admin.auth().getUser(user.uid);
  console.log('OK — acesso restaurado:');
  console.log('  e-mail:', after.email);
  console.log('  uid:', after.uid);
  console.log('  emailVerified:', after.emailVerified);
  console.log('  provedores:', after.providerData.map((p) => p.providerId).join(', ') || '(nenhum)');
  process.exit(0);
})().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
