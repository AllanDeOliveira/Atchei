/**
 * Utilitários de processamento de imagem.
 * Centraliza funções de compressão e conversão usadas por CreateEvent e Profile.
 */

/**
 * Canvas -> File. WebP fica ~30% menor que JPEG na mesma qualidade e todo navegador atual
 * decodifica (iOS 14+). Navegador sem codificador WebP devolve PNG (spec) ou null: aí cai no
 * JPEG. Devolve null se o canvas estiver vazio. A extensão do nome segue o formato gerado.
 */
export const canvasParaArquivo = (canvas: HTMLCanvasElement, fileName: string, quality: number): Promise<File | null> =>
  new Promise((resolve) => {
    const nome = (ext: string) => fileName.replace(/\.[a-z0-9]+$/i, '') + ext;
    canvas.toBlob((webp) => {
      if (webp?.type === 'image/webp') return resolve(new File([webp], nome('.webp'), { type: 'image/webp' }));
      canvas.toBlob(
        (jpeg) => resolve(jpeg ? new File([jpeg], nome('.jpg'), { type: 'image/jpeg' }) : null),
        'image/jpeg',
        quality
      );
    }, 'image/webp', quality);
  });

/**
 * Redimensiona e comprime uma imagem (WebP, ou JPEG onde não há codificador), devolvendo um
 * File pronto para upload. Em falha (formato não decodificável, sem canvas) devolve o original.
 */
export const compressImage = (
  file: File,
  maxWidth: number = 600,
  maxHeight: number = 600,
  quality: number = 0.7,
  fileName: string = 'imagem.jpg'
): Promise<File> =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, maxWidth / img.width, maxHeight / img.height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(file);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvasParaArquivo(canvas, fileName, quality).then((arquivo) => resolve(arquivo ?? file));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });

/**
 * Verifica se uma URL representa um arquivo de vídeo.
 */
export const isVideoUrl = (url: string): boolean => {
  const clean = (url || '').split('?')[0].toLowerCase();
  return /\.(mp4|mov|webm|avi|mkv|3gp)$/.test(clean) || clean.includes('/video/');
};

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

// Pôster: teto de 1200 px no lado maior e qualidade 0.8 (WebP; JPEG onde não há codificador).
// Cada abertura do feed baixa
// até 10 pôsteres e o bucket cobra por GB transferido (São Paulo não tem cota
// gratuita); um recorte cru de câmera passa de 3 MB, comprimido fica perto de
// 150 KB sem diferença visível no celular.
const POSTER_MAX_PX = 1200;
const POSTER_QUALITY = 0.8;

/**
 * Imagem inteira, sem recorte, só comprimida: flyer em pé (1080 × 1920, formato de Story)
 * não cabe na faixa 16:9 — o recorte jogava fora dois terços da arte. A capa mostra a
 * imagem em pé inteira sobre um fundo desfocado (ver components/CapaEvento).
 */
export async function getImagemInteira(imageSrc: string, fileName: string = 'poster.jpg'): Promise<File> {
  const img = await createImage(imageSrc);
  return getCroppedImg(imageSrc, { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight }, fileName);
}

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  fileName: string = 'cropped.jpg'
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const escala = Math.min(1, POSTER_MAX_PX / Math.max(pixelCrop.width, pixelCrop.height));
  canvas.width = Math.round(pixelCrop.width * escala);
  canvas.height = Math.round(pixelCrop.height * escala);

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  const arquivo = await canvasParaArquivo(canvas, fileName, POSTER_QUALITY);
  if (!arquivo) throw new Error('Canvas is empty');
  return arquivo;
}

