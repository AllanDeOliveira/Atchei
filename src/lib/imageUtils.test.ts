import { describe, it, expect } from 'vitest';
import { isVideoUrl } from './imageUtils';

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
});
