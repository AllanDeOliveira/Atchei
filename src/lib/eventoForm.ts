// Formulário de evento: estado cru (strings) e validação em código puro. Substitui o
// schema zod + react-hook-form que existiam só para esta tela: três dependências para um
// formulário. As mensagens e as regras são as mesmas do schema antigo.

export interface EventoForm {
  title: string;
  date: string;
  time: string;
  publicType: string;
  category: string;
  description: string;
  location: string;
  address: string;
  mediaUrls: string[];
  hasTickets: boolean;
  ticketPrice: string;
  isTestEvent: boolean;
  hasPresence: boolean;
  /** Teto total de participantes; string no form, convertido no submit. Vazio = sem limite. */
  maxParticipants: string;
  whatsappContacts: { name: string; phone: string }[];
}

/** Evento novo. Presença gratuita nasce desligada (decisão de produto). */
export const EVENTO_VAZIO: EventoForm = {
  title: '',
  date: '',
  time: '',
  publicType: 'Aberto',
  category: 'Festa',
  description: '',
  location: 'Centro',
  address: '',
  mediaUrls: [],
  hasTickets: false,
  ticketPrice: '',
  isTestEvent: false,
  hasPresence: false,
  maxParticipants: '',
  whatsappContacts: [{ name: '', phone: '' }],
};

/** Devolve todas as mensagens de erro, na ordem dos campos; vazio = pode salvar. */
export function validarEvento(f: EventoForm): string[] {
  const erros: string[] = [];
  if (f.title.length < 3) erros.push('Mínimo 3 caracteres');
  if (!f.date) erros.push('Data obrigatória');
  if (!f.time) erros.push('Horário obrigatório');
  if (!f.location) erros.push('Local obrigatório');
  if (!f.address) erros.push('Endereço obrigatório');
  if (f.description.length < 10) erros.push('A descrição deve ter no mínimo 10 caracteres');
  if (f.maxParticipants && !(/^\d+$/.test(f.maxParticipants) && Number(f.maxParticipants) > 0)) {
    erros.push('O limite de participantes deve ser um número maior que zero');
  }
  const telefone = (f.whatsappContacts[0]?.phone ?? '').replace(/\D/g, '');
  if (f.hasTickets && telefone.length < 10) erros.push('WhatsApp obrigatório para vendas (mín. 10 digitos)');
  return erros;
}
