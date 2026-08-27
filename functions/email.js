const logger = require("firebase-functions/logger");

/**
 * Envio de e-mail transacional próprio.
 *
 * Existe porque o Google recusa personalizar os templates deste projeto
 * (`EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED`): não dá para trocar o assunto, o corpo nem a
 * URL de ação pelo Console. Gerando o link no servidor e enviando o e-mail daqui,
 * o template passa a ser nosso e o link aponta para /auth/action do próprio app.
 *
 * Usa a API HTTP do Resend em vez de SMTP + nodemailer: o projeto já fala com o
 * Asaas por `fetch` sem SDK, e assim não entra dependência nova nas functions.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Escapa texto que vai para dentro do HTML do e-mail. */
const escaparHtml = (valor) =>
  String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Dispara um e-mail. Lança em falha — quem chama decide se isso vira erro para o
 * usuário ou só log (nunca deve virar erro que revele se o e-mail existe).
 */
async function enviarEmail({ para, assunto, html, texto }) {
  const apiKey = process.env.RESEND_API_KEY;
  const remetente = process.env.EMAIL_FROM;

  if (!apiKey || !remetente) {
    throw new Error('RESEND_API_KEY ou EMAIL_FROM ausente na configuração das functions.');
  }

  const resposta = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: remetente, to: [para], subject: assunto, html, text: texto }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text().catch(() => '');
    throw new Error(`Resend respondeu ${resposta.status}: ${corpo.slice(0, 300)}`);
  }

  return resposta.json();
}

/** Layout dos e-mails do Atchei: âmbar sobre off-white, igual ao app. */
function moldura({ titulo, corpo, textoBotao, link }) {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#FFFCF8;font-family:'Segoe UI',Helvetica,Arial,sans-serif;color:#1C1917;">
  <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border:1px solid rgba(28,25,23,0.08);border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 16px;font-size:22px;color:#1C1917;">${escaparHtml(titulo)}</h1>
    <div style="font-size:14px;line-height:1.6;color:#57534E;">${corpo}</div>
    <div style="text-align:center;margin:28px 0 8px;">
      <a href="${escaparHtml(link)}" style="display:inline-block;background:#FFB34D;color:#000000;font-weight:bold;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:12px;">${escaparHtml(textoBotao)}</a>
    </div>
    <p style="font-size:12px;line-height:1.6;color:#A8A29E;margin:20px 0 0;">
      Se o botão não funcionar, copie e cole este endereço no navegador:<br>
      <span style="word-break:break-all;color:#57534E;">${escaparHtml(link)}</span>
    </p>
  </div>
  <p style="max-width:480px;margin:16px auto 0;font-size:11px;color:#A8A29E;text-align:center;">
    Atchei — eventos e ingressos
  </p>
</body></html>`;
}

/** E-mail de redefinição de senha, com link para a tela do próprio app. */
async function enviarEmailResetSenha(email, link) {
  const html = moldura({
    titulo: 'Redefinir sua senha',
    corpo: `<p style="margin:0 0 12px;">Recebemos um pedido para redefinir a senha da conta <strong>${escaparHtml(email)}</strong>.</p>
            <p style="margin:0;">O link vale por 1 hora e só pode ser usado uma vez.</p>`,
    textoBotao: 'Criar nova senha',
    link,
  });

  const texto = [
    'Redefinir sua senha',
    '',
    `Recebemos um pedido para redefinir a senha da conta ${email}.`,
    'O link vale por 1 hora e só pode ser usado uma vez.',
    '',
    link,
    '',
    'Se não foi você quem pediu, ignore este e-mail — a senha atual continua valendo.',
  ].join('\n');

  await enviarEmail({
    para: email,
    assunto: 'Redefinir sua senha — Atchei',
    html,
    texto,
  });

  logger.info(`E-mail de redefinição enviado para ${email}.`);
}

module.exports = { enviarEmail, enviarEmailResetSenha, escaparHtml };
