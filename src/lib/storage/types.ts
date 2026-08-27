import type { Timestamp } from 'firebase/firestore';

export interface AppProfile {
  id: string;
  name: string;
  // 'atletica'/'estabelecimento' foram fundidos em 'profissional'; docs antigos no
  // Firestore ainda podem carregar os valores legados — trate qualquer tipo que não
  // seja 'user'/'admin' como profissional.
  type: 'user' | 'profissional' | 'admin';
  description: string;
  imageUrl?: string;
  email?: string;
  password?: string;
  mustChangePassword?: boolean;
  instagram?: string;
  /** Data de nascimento (YYYY-MM-DD). Cadastros exigem 18+; docs antigos não têm o campo. */
  birthDate?: string;
};

export type User = {
  id: string;
  name: string;
  username: string;
  role: 'user' | 'partner' | 'admin';
  mustChangePassword?: boolean;
  imageUrl?: string;
  profileId?: string;
};

export interface TicketType {
  id: string;
  name: string;
  price: number;
  capacity: number;
  /** Legado: os vendidos moram em EventItem.soldByTicket (só o backend escreve). */
  sold?: number;
  status: 'active' | 'sold_out';
}

export type EventCategory = 'Festa' | 'Universitário' | 'Show' | 'Esporte' | 'Gastronomia' | 'Cultural' | 'Outros';

export const EVENT_CATEGORIES: EventCategory[] = [
  'Festa',
  'Universitário',
  'Show',
  'Esporte',
  'Gastronomia',
  'Cultural',
  'Outros'
];

export type EventItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  address?: string;
  mediaUrls?: string[];
  publicType: 'Aberto' | 'Geral' | 'Universitário';
  category?: EventCategory;
  description: string;
  creatorId: string;
  hasTickets?: boolean;
  hasPixTickets?: boolean;
  ticketPrice?: string;
  pixTicketPrice?: string;
  whatsappContacts?: { name: string; phone: string }[];
  isTestEvent?: boolean;
  registrationCount?: number;
  tickets?: TicketType[]; // Múltiplos tipos de ingressos e lotes
  /** Vendidos por lote, gerido SÓ pelo backend (rules bloqueiam escrita do cliente). */
  soldByTicket?: { [ticketId: string]: number };
  hasPresence?: boolean;
};

/** Evento expira só no fim do seu dia: visível durante todo o dia da data marcada. */
export const eventoVigente = (e: Pick<EventItem, 'date'>): boolean => {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  return new Date(`${e.date}T00:00`) >= inicioHoje;
};

/** Vendidos de um lote — fonte única, escrita só pelo backend. */
export const soldCount = (event: Pick<EventItem, 'soldByTicket'>, ticket: Pick<TicketType, 'id'>): number =>
  event.soldByTicket?.[ticket.id] ?? 0;

/** Intenção de compra via WhatsApp: entra na lista do vendedor sem valer como ingresso.
 *  Vira ingresso quando o vendedor confirma o pagamento (STATUS_PAGO_WHATSAPP). */
export const STATUS_AGUARDANDO = 'Aguardando pagamento';
export const STATUS_PAGO_WHATSAPP = 'Pago (WhatsApp)';

export type Registration = {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  userCpf?: string;
  paymentStatus?: string;
  timestamp: string;
  ticketTypeId?: string;   // ID do tipo de ingresso (lote) adquirido
  ticketTypeName?: string; // Nome do tipo de ingresso (lote) adquirido
  pedidoId?: string;       // ID do pedido de pagamento
  checkedIn?: boolean;     // Ingresso já validado na portaria?
  checkedInAt?: string;    // Quando foi validado (ISO)
  checkedInBy?: string;    // Quem validou (nome do operador)
  isTeste?: boolean;       // Ingresso de teste (gerado por admin, fora do faturamento real)
};

// Pedido de pagamento (Pix via Asaas). Criado e alterado exclusivamente pelas
// Cloud Functions; o cliente apenas lê (dono do pedido, admin ou criador do evento).
export type Pedido = {
  id: string;
  valor: number;
  eventId: string;
  eventTitle?: string;
  userId: string;
  clienteNome?: string;
  clienteEmail?: string;
  // pendente | pago | estornado | chargeback | cancelado | rejeitado
  status: string;
  itensComprados?: { id: string; name?: string; quantity: number }[];
  // Split: `split: false` = cobrança sem recebedor cadastrado (tudo na plataforma).
  // Os valores em reais são ESTIMATIVAS sobre o bruto — o Asaas reparte sobre o
  // netValue (bruto − tarifa dele), então o repasse exato só é conhecido na liquidação.
  split?: boolean;
  splitPercentualOrganizador?: number;
  applicationFee?: number;
  valorLiquidoOrganizador?: number;
  overbooked?: boolean;
  isTeste?: boolean; // Pedido de teste (gerado por admin) — não entra no faturamento real
  dataCriacao?: Timestamp | null;
  dataPagamento?: Timestamp | null;
  dataEstorno?: Timestamp | null;
};
