import { useNavigate } from 'react-router-dom';
import type { EventItem } from '../lib/storage';
import { Navigation, Clock, MapPin, ExternalLink, Ticket, Flame } from 'lucide-react';
import { isVideoUrl } from '../lib/imageUtils';
import { mapsDirUrl, waMeUrl, formatDateBR, confirmadosLabel } from '../lib/formatters';
import { CapaEvento } from './CapaEvento';

interface EventCardProps {
  event: EventItem;
  variant?: 'default' | 'highlight';
  /** Primeiro cartão com capa na tela (ver CapaEvento). */
  prioridade?: boolean;
}

export const EventCard = ({ event, variant = 'default', prioridade = false }: EventCardProps) => {
  const navigate = useNavigate();
  const provaSocial = confirmadosLabel(event.registrationCount || 0);


  const openMaps = () => {
    window.open(mapsDirUrl(event.location, event.address), '_blank');
  };

  const openWhatsApp = () => {
    const contact = (event.whatsappContacts || [])[0];
    if (!contact) return;
    const message = `Olá${contact.name ? ` ${contact.name}` : ''}! Gostaria de comprar ingresso para o evento *${event.title}* (${event.time} - ${event.location}).`;
    window.open(waMeUrl(contact.phone, message), '_blank');
  };



  if (variant === 'highlight') {
    return (
      <button
        type="button"
        aria-label={`Ver detalhes de ${event.title}`}
        className="relative min-w-[260px] max-w-[260px] h-[180px] md:min-w-[440px] md:max-w-[440px] md:h-[260px] rounded-2xl overflow-hidden border border-glassBorder shadow-sm hover:-translate-y-1 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer shrink-0 group text-left block"
        onClick={() => navigate(`/event/${event.id}`)}
      >
        {/* Background */}
        {event.mediaUrls && event.mediaUrls.length > 0 ? (
          isVideoUrl(event.mediaUrls[0]) ? (
            <video
              src={event.mediaUrls[0]}
              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              muted
              loop
              playsInline
              autoPlay
            />
          ) : (
            <CapaEvento src={event.mediaUrls[0]} alt={event.title} prioridade={prioridade} className="absolute inset-0 w-full h-full overflow-hidden" imgClassName="group-hover:scale-105 transition-transform duration-500" />
          )
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-surface flex items-center justify-center p-6">
            <img 
              src={`${import.meta.env.BASE_URL}placeholder-logo.png`}
              alt=""
              width={155}
              height={152}
              className="w-auto h-12 object-contain opacity-40 group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}

        {/* Gradient Overlay - Dark Shadow (no white fade) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent z-10" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
          {event.category && (
            <span className="inline-block px-2 py-0.5 mb-1.5 rounded-md bg-white/20 backdrop-blur-md text-white text-xs font-semibold tracking-wide">
              {event.category}
            </span>
          )}
          <h3 className="font-display font-semibold text-base md:text-xl text-white leading-tight truncate">
            {event.title}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <Clock size={12} className="text-white/70" />
            <span className="font-mono text-xs text-white/95 font-bold">{formatDateBR(event.date)} {event.time}</span>
            <span className="text-white/30">·</span>
            <MapPin size={12} className="text-white/70" />
            <span className="font-mono text-xs text-white/90 truncate">{event.location}</span>
          </div>
        </div>

      </button>
    );
  }

  return (
    <>
      <div className="surface surface-hover rounded-2xl overflow-hidden flex flex-col group text-left">
        {/* Image Section */}
        <button type="button" aria-label={`Ver detalhes de ${event.title}`} className="h-44 relative overflow-hidden cursor-pointer block w-full" onClick={() => navigate(`/event/${event.id}`)}>
          {event.mediaUrls && event.mediaUrls.length > 0 ? (
            isVideoUrl(event.mediaUrls[0]) ? (
              <video
                src={event.mediaUrls[0]}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                muted
                loop
                playsInline
                autoPlay
              />
            ) : (
              <CapaEvento src={event.mediaUrls[0]} alt={event.title} prioridade={prioridade} className="relative w-full h-full overflow-hidden" imgClassName="transition-transform duration-500 group-hover:scale-105" />
            )
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-surface via-surfaceHover to-surface flex items-center justify-center p-6">
              <img 
                src={`${import.meta.env.BASE_URL}placeholder-logo.png`}
                alt=""
                width={155}
                height={152}
                className="w-auto h-12 object-contain opacity-50 transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          )}

          {/* Category badge top left */}
          {event.category && (
            <div className="absolute top-3 left-3">
              <span className="bg-surface/90 border border-glassBorder rounded-lg px-2.5 py-1 text-xs font-semibold text-textLight backdrop-blur-sm shadow-sm">
                {event.category}
              </span>
            </div>
          )}

          {/* Time badge top right */}
          <div className="absolute top-3 right-3">
            <div className="bg-surface/90 border border-glassBorder rounded-lg px-3 py-1 flex items-center gap-1.5 backdrop-blur-sm">
              <Clock size={12} className="text-accent" />
              <span className="font-mono text-xs font-bold text-textLight">{formatDateBR(event.date)} {event.time}</span>
            </div>
          </div>
        </button>

        {/* Info Section */}
        <div className="p-4 relative z-10 border-t border-glassBorder bg-surface/30">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-lg text-textLight leading-tight truncate">
                <button type="button" onClick={() => navigate(`/event/${event.id}`)} className="max-w-full truncate text-left hover:underline cursor-pointer">
                  {event.title}
                </button>
              </h3>

              {/* Location - clickable for maps */}
              <button
                onClick={(e) => { e.stopPropagation(); openMaps(); }}
                className="mt-2 w-full min-w-0 flex items-center gap-1.5 text-accent hover:text-accentHover transition-colors group/loc cursor-pointer"
              >
                <MapPin size={14} className="shrink-0" />
                <span className="font-mono text-xs truncate group-hover/loc:underline">{event.location}</span>
                <ExternalLink size={10} className="shrink-0 opacity-0 group-hover/loc:opacity-100 transition-opacity" />
              </button>

              {event.address && (
                <button
                  onClick={(e) => { e.stopPropagation(); openMaps(); }}
                  className="mt-1 w-full min-w-0 flex items-center gap-1.5 text-textMuted hover:text-textLight transition-colors group/addr cursor-pointer"
                >
                  <MapPin size={11} className="shrink-0" />
                  <span className="text-xs truncate group-hover/addr:underline">
                    {event.address}
                  </span>
                </button>
              )}

              {provaSocial && (
                <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-accent">
                  <Flame size={11} className="shrink-0" /> {provaSocial}
                </p>
              )}
            </div>

          </div>

          {/* Ações com texto e alvo de 44px: só ícone com `title` não diz nada no toque. */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={(e) => { e.stopPropagation(); openMaps(); }}
              className="flex-1 h-11 rounded-xl bg-background border border-glassBorder text-textLight text-sm font-semibold flex items-center justify-center gap-2 hover:bg-surfaceHover transition-colors duration-200 neo-click cursor-pointer"
            >
              <Navigation size={16} className="text-accent" /> Como chegar
            </button>
            {/* Só quando o toque tem para onde ir: evento com venda e um WhatsApp de contato. */}
            {event.hasTickets && event.whatsappContacts?.[0] && (
              <button
                onClick={(e) => { e.stopPropagation(); openWhatsApp(); }}
                className="flex-1 h-11 rounded-xl bg-primary text-textDark text-sm font-semibold flex items-center justify-center gap-2 hover:bg-primaryHover transition-colors duration-200 neo-click cursor-pointer"
              >
                <Ticket size={16} /> Comprar ingresso
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
