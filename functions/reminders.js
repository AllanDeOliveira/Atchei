const logger = require("firebase-functions/logger");

/**
 * Calcula a data de amanhã no fuso horário especificado no formato YYYY-MM-DD.
 */
function getTomorrowDateString(baseDate = new Date(), timeZone = 'America/Sao_Paulo') {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    
    // Avança 24 horas
    const nextDay = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
    return formatter.format(nextDay); // Retorna YYYY-MM-DD
}

/**
 * Processa e envia lembretes D-1 para todos os eventos agendados para a data alvo.
 * @param {FirebaseFirestore.Firestore} db Instância do Firestore
 * @param {string} targetDate Data alvo no formato YYYY-MM-DD
 * @param {Function} enviarPush Função de envio de notificação push (userId, title, body, link)
 */
async function processarLembretesD1(db, targetDate, enviarPush) {
    if (!targetDate || typeof enviarPush !== 'function') {
        logger.warn('Lembrete D-1: Parâmetros inválidos fornecidos.');
        return { totalEventos: 0, totalNotificacoes: 0 };
    }

    logger.info(`Lembrete D-1: Buscando eventos para a data ${targetDate}...`);
    
    // Busca eventos da data alvo que não sejam eventos de teste
    const eventsSnap = await db.collection('events')
        .where('date', '==', targetDate)
        .get();

    if (eventsSnap.empty) {
        logger.info(`Lembrete D-1: Nenhum evento encontrado para ${targetDate}.`);
        return { totalEventos: 0, totalNotificacoes: 0 };
    }

    let totalNotificacoes = 0;
    const eventosValidos = eventsSnap.docs.filter(d => !d.data().isTestEvent);

    for (const doc of eventosValidos) {
        const eventId = doc.id;
        const eventData = doc.data();
        const eventTitle = eventData.title || 'Seu Evento';
        const eventTime = eventData.time ? ` às ${eventData.time}` : '';
        const eventLocation = eventData.location ? ` em ${eventData.location}` : '';

        // Busca todas as inscrições confirmadas deste evento
        const regsSnap = await db.collection('registrations')
            .where('eventId', '==', eventId)
            .get();

        if (regsSnap.empty) continue;

        // Agrupa por userId para não enviar push duplicado para quem comprou múltiplos ingressos
        const userIdsNotificados = new Set();

        for (const regDoc of regsSnap.docs) {
            const regData = regDoc.data();
            const userId = regData.userId;
            
            // Ignora se for inscrição de teste, se não tiver userId ou se já foi notificado neste lote
            if (!userId || regData.isTeste === true || userIdsNotificados.has(userId)) {
                continue;
            }

            userIdsNotificados.add(userId);

            const pushTitle = 'Seu evento é amanhã! ⏰';
            const pushBody = `Prepare-se! "${eventTitle}" acontece amanhã${eventTime}${eventLocation}. Toque para ver seu ingresso.`;
            const pushLink = `/event/${eventId}`;

            try {
                await enviarPush(userId, pushTitle, pushBody, pushLink);
                totalNotificacoes++;
            } catch (err) {
                logger.error(`Erro ao disparar push D-1 para o usuário ${userId} do evento ${eventId}:`, err);
            }
        }
    }

    logger.info(`Lembrete D-1 concluído: ${eventosValidos.length} eventos processados, ${totalNotificacoes} notificações enviadas.`);
    return { totalEventos: eventosValidos.length, totalNotificacoes };
}

module.exports = {
    getTomorrowDateString,
    processarLembretesD1
};
