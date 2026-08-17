import { describe, it, expect, vi } from 'vitest';
const { escapeHtml, formatDateBR, generateOgHtml, handleOgPreview } = require('./ogPreview');

describe('Open Graph Preview Generator', () => {
    it('escapa caracteres especiais em HTML para segurança contra XSS', () => {
        const input = '<script>alert("XSS & fun")</script>\'';
        const escaped = escapeHtml(input);
        expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS &amp; fun&quot;)&lt;/script&gt;&#39;');
    });

    it('formata datas YYYY-MM-DD para DD/MM/YYYY corretamente', () => {
        expect(formatDateBR('2026-10-25')).toBe('25/10/2026');
        expect(formatDateBR('')).toBe('');
    });

    it('gera documento HTML completo com tags og: e redirecionamento', () => {
        const event = {
            title: 'Festa dos Bixos 2026',
            date: '2026-10-25',
            time: '22:00',
            location: 'Chácara Vale Verde',
            description: 'A melhor recepção de calouros da região com open bar e DJs renomados.',
            mediaUrls: ['https://firebasestorage.googleapis.com/v0/b/app/evento.jpg']
        };

        const html = generateOgHtml({
            event,
            eventId: 'evt-bixos-123',
            appBaseUrl: 'https://atchei.com.br'
        });

        expect(html).toContain('<title>Festa dos Bixos 2026 — Atchei</title>');
        expect(html).toContain('content="Festa dos Bixos 2026 — Atchei"');
        expect(html).toContain('content="25/10/2026 às 22:00 em Chácara Vale Verde.');
        expect(html).toContain('content="https://firebasestorage.googleapis.com/v0/b/app/evento.jpg"');
        expect(html).toContain('content="https://atchei.com.br/event/evt-bixos-123"');
        expect(html).toContain('window.location.replace("https://atchei.com.br/event/evt-bixos-123")');
    });

    it('usa imagem padrão quando evento não possui mediaUrls', () => {
        const event = {
            title: 'Sem Foto',
            description: 'Evento sem imagem.'
        };

        const html = generateOgHtml({
            event,
            eventId: 'evt-sem-foto',
            appBaseUrl: 'https://atchei.com.br'
        });

        expect(html).toContain('content="https://atchei.com.br/apple-touch-icon.png"');
    });

    it('handleOgPreview redireciona para o app se o evento não existir', async () => {
        const req = {
            path: '/e/inexistente',
            query: {}
        };
        const res = {
            redirect: vi.fn(),
            set: vi.fn(),
            status: vi.fn().mockReturnThis(),
            send: vi.fn()
        };

        const db = {
            collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue({
                    get: vi.fn().mockResolvedValue({ exists: false })
                })
            })
        };

        await handleOgPreview(req, res, db);
        expect(res.redirect).toHaveBeenCalledWith(302, 'https://atchei.web.app/feed');
    });

    it('handleOgPreview envia HTML 200 com cache header quando evento existe', async () => {
        const req = {
            path: '/e/evt-1',
            query: {}
        };
        const res = {
            redirect: vi.fn(),
            set: vi.fn(),
            status: vi.fn().mockReturnThis(),
            send: vi.fn()
        };

        const db = {
            collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue({
                    get: vi.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                            title: 'Show Sertanejo',
                            date: '2026-11-10',
                            time: '21:00',
                            location: 'Espaço Nobre',
                            description: 'Show ao vivo.'
                        })
                    })
                })
            })
        };

        await handleOgPreview(req, res, db);
        expect(res.set).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Show Sertanejo'));
    });
});
