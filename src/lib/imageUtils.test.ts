import { describe, it, expect } from 'vitest';
import { isVideoUrl, dataURLtoBlob } from './imageUtils';

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

  describe('dataURLtoBlob', () => {
    it('deve converter base64 data URL para um objeto Blob', () => {
      const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const blob = dataURLtoBlob(base64Data);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/png');
    });
  });
});
