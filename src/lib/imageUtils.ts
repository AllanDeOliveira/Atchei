/**
 * Utilitários de processamento de imagem.
 * Centraliza funções de compressão e conversão usadas por CreateEvent e Profile.
 */

/**
 * Comprime uma imagem File para base64 JPEG com dimensões e qualidade configuráveis.
 */
export const compressImage = (
  file: File,
  maxWidth: number = 600,
  maxHeight: number = 600,
  quality: number = 0.7
): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = () => {
        resolve(event.target?.result as string);
      };
    };
    reader.onerror = () => {
      resolve('');
    };
  });
};

/**
 * Converte um data URL (base64) em um Blob.
 */
export const dataURLtoBlob = (dataurl: string): Blob => {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)![1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

/**
 * Verifica se uma URL representa um arquivo de vídeo.
 */
export const isVideoUrl = (url: string): boolean => {
  if (!url) return false;
  const cleanUrl = url.split('?')[0].toLowerCase();
  return (
    cleanUrl.endsWith('.mp4') ||
    cleanUrl.endsWith('.mov') ||
    cleanUrl.endsWith('.webm') ||
    cleanUrl.endsWith('.avi') ||
    cleanUrl.endsWith('.mkv') ||
    cleanUrl.endsWith('.3gp') ||
    cleanUrl.includes('/video/')
  );
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

