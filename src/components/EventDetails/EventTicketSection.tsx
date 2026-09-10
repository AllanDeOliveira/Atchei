import React from 'react';
import { CheckCircle2, Ticket, FlaskConical, Loader2, Flame, Clock } from 'lucide-react';
import type { EventItem, User, Registration } from '../../lib/storage';
import { STATUS_AGUARDANDO } from '../../lib/storage';
import { confirmadosLabel } from '../../lib/formatters';

interface EventTicketSectionProps {
  event: EventItem;
  currentUser: User | null;
  /** Inscrição do usuário logado neste evento (null = nenhuma). */
  myRegistration: Registration | null;
  loadingTestTicket: boolean;
  onConfirmPresence: () => void;
  onCancelPresence: () => void;
  /** Compra via WhatsApp: registra a intenção (lista do vendedor) e abre o chat. */
  onWhatsAppBuy: () => void;
  onGerarIngressoTeste: () => void;
}

export const EventTicketSection: React.FC<EventTicketSectionProps> = ({
  event,
  currentUser,
  myRegistration,
  loadingTestTicket,
  onConfirmPresence,
  onCancelPresence,
  onWhatsAppBuy,
  onGerarIngressoTeste,
}) => {
  const isRegistered = !!myRegistration;
  // Presença gratuita funciona como "curtida": pode ser desfeita. Ingresso pago, não.
  const presencaCancelavel = isRegistered && myRegistration?.paymentStatus === 'Gratuito';
  // Intenção de compra via WhatsApp ainda não confirmada pelo vendedor.
  const aguardandoVendedor = myRegistration?.paymentStatus === STATUS_AGUARDANDO;
  const provaSocial = confirmadosLabel(event.registrationCount || 0);
  // Teto total atingido: some o CTA de confirmar/comprar (as rules bloqueiam no servidor).
  const lotado = event.maxParticipants != null && (event.registrationCount || 0) >= event.maxParticipants;
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

        {/* Prova social: contador de confirmados alimenta o "Em alta" e convence quem chega */}
        {provaSocial && (
          <div className="flex items-center gap-1.5 text-primary font-sans font-semibold text-xs z-10">
            <Flame size={14} />
            <span>{provaSocial}</span>
          </div>
        )}

        {/* Ações de Inscrição */}
        <div className="flex flex-col gap-2.5 z-10">
          {aguardandoVendedor ? (
            <>
              <div className="w-full rounded-xl py-4 bg-primary/10 border border-primary/20 text-primary flex items-center justify-center gap-2 font-sans font-semibold text-sm select-none">
                <Clock size={16} />
                <span>Aguardando confirmação do vendedor</span>
              </div>
              <button
                onClick={onWhatsAppBuy}
                className="w-full rounded-xl py-3.5 flex items-center justify-center gap-2 transition-all duration-200 font-sans font-semibold text-sm border-0 bg-success text-textDark hover:brightness-95 cursor-pointer neo-click"
              >
                <Ticket size={18} />
                Falar com o vendedor no WhatsApp
              </button>
              <button
                onClick={onCancelPresence}
                className="text-xs text-textMuted hover:text-danger underline underline-offset-2 transition-colors cursor-pointer self-center"
              >
                Desistir da compra
              </button>
            </>
          ) : isRegistered ? (
            <>
              <div className="w-full rounded-xl py-4 bg-accent/10 border border-accent/20 text-accent flex items-center justify-center gap-2 font-sans font-semibold text-sm select-none">
                <CheckCircle2 size={16} className="text-accent" />
                <span>{presencaCancelavel ? 'Presença confirmada!' : 'Presença confirmada · ingresso garantido'}</span>
              </div>
              {presencaCancelavel && (
                <button
                  onClick={onCancelPresence}
                  className="text-xs text-textMuted hover:text-danger underline underline-offset-2 transition-colors cursor-pointer self-center"
                >
                  Cancelar presença
                </button>
              )}
            </>
          ) : lotado ? (
            <div className="w-full rounded-xl py-4 bg-danger/10 border border-danger/20 text-danger flex items-center justify-center gap-2 font-sans font-semibold text-sm select-none">
              <Ticket size={16} />
              <span>Evento esgotado</span>
            </div>
          ) : (
            <>
              {event.hasPresence !== false && (
                <button
                  onClick={onConfirmPresence}
                  className="w-full rounded-xl py-4 shadow-sm flex items-center justify-center gap-2 transition-all duration-200 font-sans font-semibold text-sm border-0 cursor-pointer neo-click bg-primary text-textDark hover:bg-primaryHover"
                >
                  <Flame size={16} />
                  Eu vou! Confirmar presença
                </button>
              )}

              {event.hasTickets ? (
                <button
                  onClick={onWhatsAppBuy}
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
