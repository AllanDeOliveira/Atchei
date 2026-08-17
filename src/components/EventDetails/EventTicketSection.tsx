import React from 'react';
import { CheckCircle2, QrCode, Ticket, FlaskConical, Loader2 } from 'lucide-react';
import type { EventItem, User } from '../../lib/storage';
import { PIX_ENABLED } from '../../lib/flags';
import { waMeUrl } from '../../lib/formatters';

interface EventTicketSectionProps {
  event: EventItem;
  currentUser: User | null;
  isRegistered: boolean;
  loadingTestTicket: boolean;
  onOpenFreeTicketModal: () => void;
  onOpenPixModal: () => void;
  onOpenContactsModal: () => void;
  onGerarIngressoTeste: () => void;
}

export const EventTicketSection: React.FC<EventTicketSectionProps> = ({
  event,
  currentUser,
  isRegistered,
  loadingTestTicket,
  onOpenFreeTicketModal,
  onOpenPixModal,
  onOpenContactsModal,
  onGerarIngressoTeste,
}) => {
  const formatPriceDisplay = () => {
    if (!event.hasTickets) return 'Gratuito';
    if (!event.ticketPrice) return 'Consulte';
    const price = event.ticketPrice.trim();
    if (price.toUpperCase().includes('R$') || price.includes('$')) return price;
    if (/^[\d.,]+$/.test(price)) {
      if (!price.includes(',') && !price.includes('.')) return `R$ ${price},00`;
      return `R$ ${price}`;
    }
    return price;
  };

  const handleWhatsAppClick = () => {
    const contacts = event.whatsappContacts || [];
    if (contacts.length > 1) {
      onOpenContactsModal();
    } else if (contacts.length === 1) {
      const contact = contacts[0];
      const message = `Olá${contact.name ? ` ${contact.name}` : ''}! Tenho interesse no ingresso para o evento *${event.title}*`;
      window.open(waMeUrl(contact.phone, message), '_blank');
    }
  };

  return (
    <div className="fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-0 right-0 px-5 z-40 anim-up max-w-2xl mx-auto lg:relative lg:bottom-0 lg:px-0 lg:max-w-none lg:z-10">
      <div className="surface rounded-2xl p-6 flex flex-col gap-4 shadow-md lg:shadow-sm relative overflow-hidden">
        {/* Info do Ingresso */}
        <div className="flex items-center justify-between z-10 text-left">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-accent mb-1">Ingresso</span>
            <span
              className="text-2xl font-display font-semibold text-primary leading-none truncate max-w-[140px]"
              title={formatPriceDisplay()}
            >
              {formatPriceDisplay()}
            </span>
          </div>
        </div>

        {/* Ações de Inscrição */}
        <div className="flex flex-col gap-2.5 z-10">
          {isRegistered ? (
            <div className="w-full rounded-xl py-4 bg-accent/10 border border-accent/20 text-accent flex items-center justify-center gap-2 font-sans font-semibold text-sm select-none">
              <CheckCircle2 size={16} className="text-accent" />
              <span>Presença confirmada · ingresso garantido</span>
            </div>
          ) : (
            <>
              {event.hasPresence !== false && (
                <button
                  onClick={onOpenFreeTicketModal}
                  className="w-full rounded-xl py-4 shadow-sm flex items-center justify-center gap-2 transition-all duration-200 font-sans font-semibold text-sm border-0 cursor-pointer neo-click bg-primary text-textDark hover:bg-primaryHover"
                >
                  Confirmar presença
                </button>
              )}

              {PIX_ENABLED && event.hasPixTickets ? (
                <button
                  onClick={onOpenPixModal}
                  className="rounded-xl px-5 py-4 shadow-sm flex items-center justify-center gap-2 transition-all duration-200 font-sans font-semibold text-sm border-0 cursor-pointer neo-click bg-success text-textDark hover:brightness-95"
                >
                  <QrCode size={16} />
                  <span>Comprar via Pix</span>
                </button>
              ) : (event.hasTickets || event.hasPixTickets) ? (
                <button
                  onClick={handleWhatsAppClick}
                  className="w-full rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all duration-200 font-sans font-semibold text-sm border-0 bg-success text-textDark hover:brightness-95 cursor-pointer neo-click"
                >
                  <Ticket size={18} />
                  <div className="flex flex-col items-start leading-none text-left">
                    <span>Comprar ingresso</span>
                    <span className="text-[10px] opacity-80 mt-1">via WhatsApp</span>
                  </div>
                </button>
              ) : null}
            </>
          )}
        </div>

        {/* Atalho de teste (somente admin) */}
        {currentUser?.role === 'admin' && (
          <button
            onClick={onGerarIngressoTeste}
            disabled={loadingTestTicket}
            className="w-full rounded-xl py-3 border border-dashed border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 font-sans font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 z-10"
          >
            {loadingTestTicket ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <FlaskConical size={15} />
            )}
            <span>{loadingTestTicket ? 'Gerando ingresso de teste…' : 'Gerar ingresso de teste (admin)'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
