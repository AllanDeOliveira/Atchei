import { describe, it, expect } from 'vitest';
import { isVideoUrl, canvasParaArquivo } from './imageUtils';

describe('imageUtils', () => {
  describe('isVideoUrl', () => {
    it('deve identificar URLs de vídeo corretamente', () => {
      expect(isVideoUrl('https://example.com/video.mp4')).toBe(true);
      expect(isVideoUrl('https://example.com/movie.webm?token=123')).toBe(true);
      expect(isVideoUrl('https://example.com/clip.mov')).toBe(true);
    });

    it('deve retornar falso para imagens ou URLs vazias', () => {
      expect(isVideoUrl('')).toBe(false);
      expect(isVideoUrl('https://example.com/banner.jpg')).toBe(false);
      expect(isVideoUrl('https://example.com/photo.png')).toBe(false);
    });
  });
  describe('canvasParaArquivo', () => {
    // toBlob falso: devolve um blob do tipo pedido, ou PNG quando "não sabe" WebP (como manda a spec).
    const canvasQue = (codificaWebp: boolean) =>
      ({
        toBlob: (cb: (b: Blob | null) => void, type: string) => {
          const real = type === 'image/webp' && !codificaWebp ? 'image/png' : type;
          cb(new Blob(['x'], { type: real }));
        },
      }) as unknown as HTMLCanvasElement;

    it('gera WebP e troca a extensão quando o navegador codifica', async () => {
      const f = await canvasParaArquivo(canvasQue(true), 'IMG_1.jpeg', 0.8);
      expect(f?.type).toBe('image/webp');
      expect(f?.name).toBe('IMG_1.webp');
    });

    it('cai no JPEG quando o navegador devolve PNG no lugar do WebP', async () => {
      const f = await canvasParaArquivo(canvasQue(false), 'poster.webp', 0.8);
      expect(f?.type).toBe('image/jpeg');
      expect(f?.name).toBe('poster.jpg');
    });

    it('devolve null com canvas vazio', async () => {
      const vazio = { toBlob: (cb: (b: Blob | null) => void) => cb(null) } as unknown as HTMLCanvasElement;
      expect(await canvasParaArquivo(vazio, 'a.jpg', 0.8)).toBeNull();
    });
  });
});
