export { formatCPF, isValidCPF, onlyDigits } from './cpf';

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

/** Data ISO curta → "12 de agosto de 2026". UTC de propósito: a data do evento não tem hora. */
export const formatDateExtenso = (dateStr: string): string => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
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

export const isValidEmail = (email: string): boolean => {
  if (!email || !email.trim()) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};
