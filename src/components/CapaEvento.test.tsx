import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CapaEvento } from './CapaEvento';

// jsdom não carrega imagem: simula o `load` com as dimensões naturais.
const carregar = (img: HTMLImageElement, w: number, h: number) => {
  Object.defineProperty(img, 'naturalWidth', { value: w, configurable: true });
  Object.defineProperty(img, 'naturalHeight', { value: h, configurable: true });
  fireEvent.load(img);
};

describe('CapaEvento', () => {
  it('foto deitada preenche a moldura, sem fundo desfocado', () => {
    const { container } = render(<CapaEvento src="a.jpg" alt="Festa" className="relative w-full h-full" />);
    const img = screen.getByAltText('Festa') as HTMLImageElement;
    carregar(img, 1600, 900);
    expect(img.className).toContain('object-cover');
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });

  it('flyer em pé aparece inteiro sobre a cópia desfocada', () => {
    const { container } = render(<CapaEvento src="a.jpg" alt="Festa" className="relative w-full h-full" />);
    const img = screen.getByAltText('Festa') as HTMLImageElement;
    carregar(img, 1080, 1920);
    expect(img.className).toContain('object-contain');
    expect(container.querySelectorAll('img')).toHaveLength(2);
  });
});
