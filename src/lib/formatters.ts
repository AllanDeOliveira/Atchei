export { formatCPF } from './cpf';

export const formatPhone = (value: string): string => {
  const digits = (value || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length > 0 ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

/** Data ISO curta (YYYY-MM-DD) → DD/MM/AAAA, sem passar por Date (evita salto de fuso). */
export const formatDateBR = (dateStr: string): string => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return day ? `${day}/${month}/${year}` : dateStr;
};

/** Timestamp em ms → "21:35". */
export const horaBR = (ms: number): string =>
  new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Data ISO curta → "12 de agosto de 2026". UTC de propósito: a data do evento não tem hora. */
export const formatDateExtenso = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/** Prova social: "Mais de X pessoas confirmadas" (marco anterior à contagem) a partir
 *  de 6; contagem exata de 3 a 5; null abaixo de 3 (número baixo não convence ninguém). */
export const confirmadosLabel = (count: number): string | null => {
  if (count < 3) return null;
  const marco = [500, 200, 100, 50, 20, 10, 5].find(m => count > m);
  return marco ? `Mais de ${marco} pessoas confirmadas` : `${count} pessoas confirmadas`;
};

/** Link wa.me: limpa o telefone, prefixa 55 (BR) quando faltar o DDI e embute a mensagem. */
export const waMeUrl = (phone: string, message: string): string => {
  let d = (phone || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(message)}`;
};

/** Link "adicionar ao Google Agenda". O evento não tem hora de término no modelo —
 *  assume 3h de duração. Horário "flutuante" (sem fuso): o Agenda usa o fuso do usuário. */
export const googleCalendarUrl = (title: string, date: string, time: string, location?: string, details?: string): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (x: Date) =>
    `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
  const inicio = new Date(`${date}T${time || '20:00'}`);
  const fim = new Date(inicio.getTime() + 3 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${fmt(inicio)}/${fmt(fim)}`,
    ...(location ? { location } : {}),
    ...(details ? { details } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
};

/** CPF mascarado para telas de terceiros (LGPD, minimização): ***.123.456-** — o miolo
 *  visível ainda permite conferir com o documento na portaria. */
export const maskCPF = (cpf: string): string => {
  const d = (cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
};

/** Telefone mascarado para telas de terceiros: (65) *****-1234. */
export const maskPhone = (phone: string): string => {
  const d = (phone || '').replace(/\D/g, '');
  if (d.length < 8) return phone;
  return `(${d.slice(0, 2)}) *****-${d.slice(-4)}`;
};

/**
 * Consulta de geocodificação: nome do local + endereço — só o endereço (sem número/
 * cidade) faz o Google marcar o bairro em vez do estabelecimento. Evita duplicar
 * quando o endereço já contém o nome do local (ex.: pick do mapa sem formattedAddress).
 */
export const mapsQuery = (location?: string, address?: string): string => {
  const loc = (location || '').trim();
  const addr = (address || '').trim();
  if (!addr) return loc;
  if (!loc || addr.toLowerCase().includes(loc.toLowerCase())) return addr;
  return `${loc}, ${addr}`;
};

/** URL de rota no Google Maps — único builder; usado por card, perfil e página do evento. */
export const mapsDirUrl = (location?: string, address?: string): string =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery(location, address))}`;

/** Célula de CSV: aspas em volta (dobradas por dentro, cobrindo `;` e quebra de linha)
 *  e apóstrofo na frente de = + - @ e tabulação, que o Excel executaria como fórmula
 *  (injeção pelo nome do participante). */
export const celulaCsv = (valor: string): string => {
  const v = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return `"${v.replace(/"/g, '""')}"`;
};
