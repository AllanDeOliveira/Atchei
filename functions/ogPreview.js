const logger = require("firebase-functions/logger");

/**
 * Escapa strings para uso seguro em atributos e conteúdo HTML.
 */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Formata data no padrão brasileiro dd/mm/aaaa.
 */
function formatDateBR(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    return `${day}/${month}/${year}`;
}

/**
 * Gera o documento HTML completo com tags Open Graph e redirecionamento para o app.
 */
function generateOgHtml({ event, eventId, appBaseUrl }) {
    const title = event?.title ? `${event.title} — Atchei` : 'Atchei — Ingressos e Eventos';
    
    // Descrição rica com data, hora, local e resumo
    const parts = [];
    if (event?.date) parts.push(formatDateBR(event.date));
    if (event?.time) parts.push(`às ${event.time}`);
    if (event?.location) parts.push(`em ${event.location}`);
    
    const contextPrefix = parts.join(' ');
    const rawDesc = event?.description || 'Encontre ingressos, confirme presença e descubra os melhores eventos no Atchei.';
    const cleanDesc = rawDesc.replace(/\s+/g, ' ').trim();
    const truncatedDesc = cleanDesc.length > 140 ? `${cleanDesc.slice(0, 137)}...` : cleanDesc;
    
    const description = contextPrefix ? `${contextPrefix}. ${truncatedDesc}` : truncatedDesc;
    const imageUrl = (event?.mediaUrls && event.mediaUrls[0])
        ? event.mediaUrls[0]
        : `${appBaseUrl}/apple-touch-icon.png`;
    
    const appUrl = `${appBaseUrl}/event/${eventId}`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    
    <!-- Open Graph / WhatsApp / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Atchei">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:image" content="${escapeHtml(imageUrl)}">
    <meta property="og:url" content="${escapeHtml(appUrl)}">
    
    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)}">
    <meta name="twitter:description" content="${escapeHtml(description)}">
    <meta name="twitter:image" content="${escapeHtml(imageUrl)}">

    <!-- Redirecionamento instantâneo para navegadores humanos -->
    <meta http-equiv="refresh" content="0; url=${escapeHtml(appUrl)}">
    <script>
        window.location.replace("${escapeHtml(appUrl)}");
    </script>
</head>
<body style="font-family: sans-serif; background: #FFFCF8; color: #1C1917; padding: 2rem; text-align: center;">
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(description)}</p>
    <p>Redirecionando para o aplicativo... <a href="${escapeHtml(appUrl)}">Clique aqui se não for redirecionado</a>.</p>
</body>
</html>`;
}

/**
 * Handler HTTP da Cloud Function para renderizar a página Open Graph.
 */
async function handleOgPreview(req, res, db) {
    const appBaseUrl = process.env.APP_BASE_URL || 'https://atchei.web.app';
    
    // Extrai o ID do evento da rota (/e/:id ou query param ?id=...)
    const pathParts = (req.path || '').split('/').filter(Boolean);
    // ex: se rota for /e/evento123 -> pathParts=['e', 'evento123']
    let eventId = req.query.id || (pathParts.length > 1 ? pathParts[1] : pathParts[0]);
    if (eventId === 'e') eventId = pathParts[1] || '';

    if (!eventId) {
        res.redirect(302, appBaseUrl);
        return;
    }

    try {
        const eventDoc = await db.collection('events').doc(eventId).get();
        if (!eventDoc.exists) {
            logger.warn(`Open Graph: Evento ${eventId} não encontrado.`);
            res.redirect(302, `${appBaseUrl}/feed`);
            return;
        }

        const event = eventDoc.data();
        const html = generateOgHtml({ event, eventId, appBaseUrl });
        
        res.set('Content-Type', 'text/html; charset=utf-8');
        // Cache CDN público de 5 minutos, permitindo revalidação rápida se a imagem/título mudar
        res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
        res.status(200).send(html);
    } catch (error) {
        logger.error(`Erro ao gerar Open Graph para o evento ${eventId}:`, error);
        res.redirect(302, `${appBaseUrl}/event/${eventId}`);
    }
}

module.exports = {
    escapeHtml,
    formatDateBR,
    generateOgHtml,
    handleOgPreview
};
