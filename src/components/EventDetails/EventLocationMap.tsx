import React from 'react';
import { MapPin } from 'lucide-react';

interface EventLocationMapProps {
  location: string;
  address: string;
}

export const EventLocationMap: React.FC<EventLocationMapProps> = ({ location, address }) => {
  const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  // Nome do local + endereço: só o endereço (sem número/cidade) faz o Google
  // geocodificar o bairro em vez do estabelecimento.
  const consulta = [location, address].filter(Boolean).join(', ');

  return (
    <div className="text-left space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-1 h-5 bg-primary/40 rounded-full" />
        <h2 className="font-display font-semibold text-xl text-textLight">Localização</h2>
      </div>
      <div className="surface rounded-2xl p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <MapPin size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-sans font-bold text-textLight text-sm truncate">{location}</p>
            <p className="text-xs text-textLight/75 font-medium font-sans mt-1.5 leading-snug">{address}</p>
          </div>
        </div>

        {/* Google Map Embed */}
        <div className="w-full h-64 md:h-80 rounded-[1.5rem] overflow-hidden border border-glassBorder/30 shadow-inner relative z-10">
          <iframe
            title="Mapa de localização do evento"
            width="100%"
            height="100%"
            className="border-none"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${encodeURIComponent(consulta)}`}
          ></iframe>
        </div>

        <button
          onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(consulta)}`, '_blank')}
          className="w-full bg-surface border border-glassBorder hover:bg-surfaceHover hover:border-primary/30 text-textLight font-sans font-semibold text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all duration-200 neo-click cursor-pointer"
        >
          <MapPin size={15} /> Ver rota no Google Maps
        </button>
      </div>
    </div>
  );
};
