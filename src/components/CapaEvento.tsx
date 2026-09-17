import { useCallback, useState } from 'react';

type Props = {
  src: string;
  alt: string;
  /** Classes da moldura (posicionamento e tamanho ficam com quem chama). */
  className: string;
  /** Classes extras da imagem da frente (ex.: zoom no hover). */
  imgClassName?: string;
};

/**
 * Capa de evento numa moldura deitada. Foto deitada preenche a moldura, como sempre.
 * Flyer em pé (formato de Story, 9:16) aparece inteiro sobre uma cópia dele mesmo
 * desfocada: recortar em faixa 16:9 jogava fora dois terços da arte, e cortar na
 * exibição deixava só o meio.
 */
export const CapaEvento = ({ src, alt, className, imgClassName = '' }: Props) => {
  const [emPe, setEmPe] = useState(false);
  const medir = (el: HTMLImageElement) => setEmPe(el.naturalHeight > el.naturalWidth);
  // Imagem já em cache dispara `load` antes de o React ligar o onLoad: mede ao montar.
  const aoMontar = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete && el.naturalWidth) medir(el);
  }, []);

  return (
    <div className={className}>
      {emPe && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl brightness-75 saturate-125"
        />
      )}
      <img
        ref={aoMontar}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={(e) => medir(e.currentTarget)}
        className={`relative w-full h-full ${emPe ? 'object-contain' : 'object-cover'} ${imgClassName}`}
      />
    </div>
  );
};
