import { useState } from 'react';
import { X } from 'lucide-react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Button } from '../ui/Button';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

interface Props {
  /** data URL da imagem escolhida. Vazio = diálogo fechado. */
  imageSrc: string;
  uploading: boolean;
  onConfirm: (area: Area) => void;
  /** Sobe a imagem inteira, sem recorte (flyer em pé). */
  onUsarInteira: () => void;
  onClose: () => void;
}

/** Recorte 16:9 da imagem do evento antes do upload, ou a imagem inteira (flyer em pé). */
export const ImageCropModal = ({ imageSrc, uploading, onConfirm, onUsarInteira, onClose }: Props) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  useEscapeToClose(!!imageSrc, onClose);

  if (!imageSrc) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] bg-background/95 backdrop-blur-md flex flex-col px-4 pt-[max(3rem,calc(env(safe-area-inset-top)+1rem))] pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+0.75rem))]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-crop-title"
    >
      <div className="flex justify-between items-center mb-6">
        <div className="text-left">
          <h2 id="create-crop-title" className="font-display font-semibold text-xl text-textLight">Ajustar imagem</h2>
          <p className="text-xs text-textMuted">Recorte 16:9 para o feed, ou use a imagem inteira se for um flyer em pé</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="bg-primary/10 p-2 rounded-full text-primary"
          title="Cancelar"
          aria-label="Cancelar e fechar o recorte da imagem"
        >
          <X size={20} />
        </button>
      </div>

      <div className="relative flex-1 bg-black/5 rounded-3xl overflow-hidden mb-6 border border-glassBorder shadow-inner">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={16 / 9}
          onCropChange={setCrop}
          onCropComplete={(_area, areaEmPixels) => setArea(areaEmPixels)}
          onZoomChange={setZoom}
        />
      </div>

      <div className="flex gap-4">
        <Button type="button" variant="secondary" className="flex-1 rounded-xl py-4" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          loading={uploading}
          disabled={!area}
          className="flex-1 rounded-xl py-4"
          onClick={() => area && onConfirm(area)}
        >
          {uploading ? 'Enviando...' : 'Confirmar corte'}
        </Button>
      </div>
      {/* Flyer em pé (formato de Story) perde dois terços no 16:9: sobe inteiro e a capa
          mostra sobre fundo desfocado. */}
      <button
        type="button"
        disabled={uploading}
        onClick={onUsarInteira}
        className="mt-4 text-sm font-sans font-semibold text-accent underline underline-offset-4 hover:text-textLight disabled:opacity-50 cursor-pointer self-center"
      >
        Usar a imagem inteira, sem recorte
      </button>
    </div>
  );
};
