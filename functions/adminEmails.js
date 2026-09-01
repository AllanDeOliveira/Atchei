// Fonte única dos e-mails de administrador. Usada SOMENTE pelo script
// scripts/set-admins.js para conceder o custom claim { admin: true } — a
// autorização em runtime (functions e security rules) é 100% via claim.
const ADMIN_EMAILS = [
  'suporte.atchei@gmail.com',
  'contato.atchei@gmail.com'
].map(e => e.toLowerCase());

// Política de autorização de admin: exclusivamente via custom claim.
function isCallerAdmin(token) {
  return token != null && token.admin === true;
}

module.exports = { ADMIN_EMAILS, isCallerAdmin };
