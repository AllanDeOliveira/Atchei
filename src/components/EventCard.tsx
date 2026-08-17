import { useNavigate } from 'react-router-dom';
import type { EventItem } from '../lib/storage';
import { Navigation, Clock, MapPin, ExternalLink, Ticket, ArrowRight } from 'lucide-react';
import { isVideoUrl } from '../lib/imageUtils';
import { mapsDirUrl, waMeUrl, formatDateBR } from '../lib/formatters';

interface EventCardProps {
  event: EventItem;
  variant?: 'default' | 'highlight';
}

export const EventCard = ({ event, variant = 'default' }: EventCardProps) => {
  const navigate = useNavigate();


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
        className="relative min-w-[260px] max-w-[260px] h-[180px] rounded-2xl overflow-hidden border border-glassBorder shadow-sm hover:-translate-y-1 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer shrink-0 group text-left block"
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
            <img src={event.mediaUrls[0]} alt={event.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          )
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-surface flex items-center justify-center p-6">
            <img 
              src={`${import.meta.env.BASE_URL}placeholder-logo.png`}
              alt=""
              className="w-auto h-12 object-contain opacity-40 group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}

        {/* Gradient Overlay - Dark Shadow (no white fade) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent z-10" />

        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
          {event.category && (
            <span className="inline-block px-2 py-0.5 mb-1.5 rounded-md bg-white/20 backdrop-blur-md text-white text-[10px] font-semibold tracking-wide">
              {event.category}
            </span>
          )}
          <h3 className="font-display font-semibold text-base text-white leading-tight truncate">
            {event.title}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
            <Clock size={12} className="text-white/70" />
            <span className="font-mono text-[10px] text-white/95 font-bold">{formatDateBR(event.date)} {event.time}</span>
            <span className="text-white/30">·</span>
            <MapPin size={12} className="text-white/70" />
            <span className="font-mono text-[10px] text-white/90 truncate">{event.location}</span>
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
              <img src={event.mediaUrls[0]} alt={event.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            )
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-surface via-surfaceHover to-surface flex items-center justify-center p-6">
              <img 
                src={`${import.meta.env.BASE_URL}placeholder-logo.png`}
                alt=""
                className="w-auto h-12 object-contain opacity-50 transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          )}

          {/* Category badge top left */}
          {event.category && (
            <div className="absolute top-3 left-3">
              <span className="bg-surface/90 border border-glassBorder rounded-lg px-2.5 py-1 text-[10px] font-semibold text-textLight backdrop-blur-sm shadow-sm">
                {event.category}
              </span>
            </div>
          )}

          {/* Time badge top right */}
          <div className="absolute top-3 right-3">
            <div className="bg-surface/90 border border-glassBorder rounded-lg px-3 py-1 flex items-center gap-1.5 backdrop-blur-sm">
              <Clock size={12} className="text-primary" />
              <span className="font-mono text-[10px] font-bold text-textLight">{formatDateBR(event.date)} {event.time}</span>
            </div>
          </div>
        </button>

        {/* Info Section */}
        <div className="p-4 relative z-10 border-t border-glassBorder bg-surface/30">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-lg text-textLight leading-tight truncate">
                {event.title}
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
                  <span className="text-[11px] truncate group-hover/addr:underline">
                    {event.address}
                  </span>
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); openWhatsApp(); }}
                className="w-9 h-9 rounded-xl bg-success/10 text-success border border-success/20 flex items-center justify-center hover:bg-success hover:text-textDark transition-all duration-200 neo-click cursor-pointer"
                title="Comprar ingresso"
              >
                <Ticket size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); openMaps(); }}
                className="w-9 h-9 rounded-xl bg-accent/10 text-accent border border-accent/20 flex items-center justify-center hover:bg-accent hover:text-textDark transition-all duration-200 neo-click cursor-pointer"
                title="Como chegar"
              >
                <Navigation size={16} />
              </button>
              <button
                onClick={() => navigate(`/event/${event.id}`)}
                className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center hover:bg-primary hover:text-textDark transition-all duration-200 neo-click cursor-pointer"
                title="Ver detalhes"
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
