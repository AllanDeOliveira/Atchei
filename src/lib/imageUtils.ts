/**
 * Utilitários de processamento de imagem.
 * Centraliza funções de compressão e conversão usadas por CreateEvent e Profile.
 */

/**
 * Redimensiona e comprime uma imagem para JPEG, devolvendo um File pronto para upload.
 * Em falha (formato não decodificável, sem canvas) devolve o arquivo original.
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
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], fileName, { type: 'image/jpeg' }) : file),
        'image/jpeg',
        quality
      );
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

// Pôster: teto de 1200 px no lado maior e JPEG a 0.8. Cada abertura do feed baixa
// até 10 pôsteres e o bucket cobra por GB transferido (São Paulo não tem cota
// gratuita); um recorte cru de câmera passa de 3 MB, comprimido fica perto de
// 150 KB sem diferença visível no celular.
const POSTER_MAX_PX = 1200;
const POSTER_JPEG_QUALITY = 0.8;

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

  return new Promise((resolve, reject) => {
    canvas.toBlob((file) => {
      if (file) {
        resolve(new File([file], fileName, { type: 'image/jpeg' }));
      } else {
        reject(new Error('Canvas is empty'));
      }
    }, 'image/jpeg', POSTER_JPEG_QUALITY);
  });
}

