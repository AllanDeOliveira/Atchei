import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { escaparHtml, enviarEmail, enviarEmailResetSenha } = require('./email');

describe('escaparHtml', () => {
  it('neutraliza marcação vinda de dado do usuário', () => {
    expect(escaparHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escaparHtml('a"b\'c&d')).toBe('a&quot;b&#39;c&amp;d');
  });
});

describe('enviarEmail', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_teste';
    process.env.EMAIL_FROM = 'Atchei <nao-responda@exemplo.com>';
    global.fetch = vi.fn();
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    vi.restoreAllMocks();
  });

  it('falha explicitamente quando a chave não está configurada', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(enviarEmail({ para: 'a@b.com', assunto: 'x', html: '<p>x</p>', texto: 'x' }))
      .rejects.toThrow(/RESEND_API_KEY/);
  });

  it('envia com o remetente e o destinatário corretos', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'abc' }) });

    await enviarEmail({ para: 'destino@exemplo.com', assunto: 'Assunto', html: '<p>oi</p>', texto: 'oi' });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = global.fetch.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(opts.headers.Authorization).toBe('Bearer re_teste');
    const body = JSON.parse(opts.body);
    expect(body.to).toEqual(['destino@exemplo.com']);
    expect(body.from).toBe('Atchei <nao-responda@exemplo.com>');
    expect(body.subject).toBe('Assunto');
  });

  it('propaga erro quando o Resend recusa', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 422, text: async () => 'dominio nao verificado' });

    await expect(enviarEmail({ para: 'a@b.com', assunto: 'x', html: '<p>x</p>', texto: 'x' }))
      .rejects.toThrow(/422/);
  });
});

describe('enviarEmailResetSenha', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_teste';
    process.env.EMAIL_FROM = 'Atchei <nao-responda@exemplo.com>';
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'abc' }) });
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    vi.restoreAllMocks();
  });

  it('inclui o link tanto no HTML quanto na versão texto', async () => {
    const link = 'https://atchei.web.app/auth/action?mode=resetPassword&oobCode=XYZ';

    await enviarEmailResetSenha('pessoa@exemplo.com', link);

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.html).toContain(link.replace(/&/g, '&amp;'));
    expect(body.text).toContain(link);
    expect(body.subject).toContain('Atchei');
  });
});
