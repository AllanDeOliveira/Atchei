import React, { useRef } from 'react';
import { ArrowLeft, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import { isVideoUrl } from '../../lib/imageUtils';
import { CapaEvento } from '../CapaEvento';

interface EventHeaderProps {
  title: string;
  mediaUrls?: string[];
  currentMediaIndex: number;
  onCurrentMediaIndexChange: (index: number) => void;
  onBack: () => void;
  onShare: () => void;
}

export const EventHeader: React.FC<EventHeaderProps> = ({
  title,
  mediaUrls,
  currentMediaIndex,
  onCurrentMediaIndexChange,
  onBack,
  onShare,
}) => {
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const mediaList = mediaUrls && mediaUrls.length > 0
    ? mediaUrls
    : [`${import.meta.env.BASE_URL}placeholder-logo.png`];

  const isPlaceholder = mediaList[currentMediaIndex]?.includes('placeholder-logo.png');

  const handleNextMedia = () => {
    onCurrentMediaIndexChange((currentMediaIndex + 1) % mediaList.length);
  };

  const handlePrevMedia = () => {
    onCurrentMediaIndexChange((currentMediaIndex - 1 + mediaList.length) % mediaList.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current - touchEndX.current > 50) {
      handleNextMedia();
    } else if (touchStartX.current - touchEndX.current < -50) {
      handlePrevMedia();
    }
  };

  return (
    <div className="space-y-6">
      {/* Image Section */}
      <div
        className="relative h-80 md:h-[420px] w-full overflow-hidden rounded-[2.5rem] shadow-glass-shadow group"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Floating Action Buttons over Image */}
        <div className="absolute top-5 left-5 right-5 flex justify-between items-center z-20">
          <button
            title="Voltar"
            aria-label="Voltar"
            onClick={onBack}
            className="w-10 h-10 bg-white/85 hover:bg-white text-textLight rounded-xl flex items-center justify-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 neo-click cursor-pointer backdrop-blur-sm"
          >
            <ArrowLeft size={18} />
          </button>

          <button
            title="Compartilhar"
            aria-label="Compartilhar"
            onClick={onShare}
            className="w-10 h-10 bg-white/85 hover:bg-white text-textLight rounded-xl flex items-center justify-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 neo-click cursor-pointer backdrop-blur-sm"
          >
            <Share2 size={18} />
          </button>
        </div>

        {isVideoUrl(mediaList[currentMediaIndex]) ? (
          <div className="w-full h-full relative flex items-center justify-center bg-black/10">
            <video
              src={mediaList[currentMediaIndex]}
              className="relative w-full h-full object-contain z-10"
              controls
              playsInline
            />
          </div>
        ) : (
          <div className={`w-full h-full relative flex items-center justify-center overflow-hidden ${isPlaceholder ? 'bg-gradient-to-br from-surface via-surfaceHover to-surface p-12' : 'bg-black/5'}`}>
            {isPlaceholder ? (
              <img
                src={mediaList[currentMediaIndex]}
                alt={title}
                className="relative z-10 select-none w-auto h-24 md:h-32 object-contain opacity-50"
                draggable="false"
              />
            ) : (
              // Foto deitada preenche a caixa; flyer em pé aparece inteiro sobre fundo desfocado.
              <CapaEvento
                src={mediaList[currentMediaIndex]}
                alt={`${title} - Foto ${currentMediaIndex + 1}`}
                className="relative z-10 w-full h-full overflow-hidden"
                imgClassName="select-none transition-all duration-300"
              />
            )}
          </div>
        )}

        {/* Carousel Navigation Controls */}
        {mediaList.length > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrevMedia}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-surface/60 rounded-xl flex items-center justify-center text-textLight shadow-sm hover:scale-105 active:scale-95 transition-all z-20 cursor-pointer hidden md:flex"
              aria-label="Mídia anterior"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={handleNextMedia}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-surface/60 rounded-xl flex items-center justify-center text-textLight shadow-sm hover:scale-105 active:scale-95 transition-all z-20 cursor-pointer hidden md:flex"
              aria-label="Próxima mídia"
            >
              <ChevronRight size={14} />
            </button>

            <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 z-20 pointer-events-auto">
              {mediaList.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onCurrentMediaIndexChange(idx)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${idx === currentMediaIndex ? 'bg-primary w-4' : 'bg-textMuted/40'}`}
                  aria-label={`Ir para foto ${idx + 1}`}
                />
              ))}
            </div>

            <div className="absolute bottom-6 right-6 bg-surface/60 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-textLight z-20 pointer-events-none backdrop-blur-md">
              {currentMediaIndex + 1} / {mediaList.length}
            </div>
          </>
        )}
      </div>

      {/* Event Title */}
      <div className="text-left">
        <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold text-textLight leading-tight mb-4 anim-up">
          {title}
        </h1>
      </div>
    </div>
  );
};
