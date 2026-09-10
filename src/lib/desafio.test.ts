import { describe, it, expect } from 'vitest';
import { estadoDesafio, msRestantes, PRAZO_MS, CARENCIA_MS, TAMANHO_GRUPO } from './desafio';

const membros = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);
const t0 = 1_700_000_000_000;

describe('estadoDesafio', () => {
  it('sem documento: livre', () => {
    expect(estadoDesafio(null, t0)).toBe('livre');
  });

  it('recém-iniciado (timestamp do servidor pendente): aberto', () => {
    expect(estadoDesafio({ membros: membros(1), iniciadoEmMs: null }, t0)).toBe('aberto');
  });

  it('dentro do prazo com menos de 5: aberto', () => {
    expect(estadoDesafio({ membros: membros(3), iniciadoEmMs: t0 }, t0 + PRAZO_MS - 1)).toBe('aberto');
  });

  it('com 5 no grupo: liberado — e a mesa fica queimada para sempre (1 prêmio por mesa)', () => {
    expect(estadoDesafio({ membros: membros(5), iniciadoEmMs: t0 }, t0 + 1000)).toBe('liberado');
    expect(estadoDesafio({ membros: membros(5), iniciadoEmMs: t0 }, t0 + PRAZO_MS + CARENCIA_MS - 1)).toBe('liberado');
    expect(estadoDesafio({ membros: membros(5), iniciadoEmMs: t0 }, t0 + 24 * 60 * 60 * 1000)).toBe('liberado');
  });

  it('prazo estourado sem 5: expirado durante toda a carência', () => {
    expect(estadoDesafio({ membros: membros(4), iniciadoEmMs: t0 }, t0 + PRAZO_MS)).toBe('expirado');
    expect(estadoDesafio({ membros: membros(4), iniciadoEmMs: t0 }, t0 + PRAZO_MS + CARENCIA_MS - 1)).toBe('expirado');
  });

  it('após prazo + carência sem os 5: livre de novo (quem perde tenta de novo)', () => {
    expect(estadoDesafio({ membros: membros(4), iniciadoEmMs: t0 }, t0 + PRAZO_MS + CARENCIA_MS)).toBe('livre');
  });

  it('grupo é de 5', () => {
    expect(TAMANHO_GRUPO).toBe(5);
  });
});

describe('msRestantes', () => {
  it('conta a partir do início do servidor e não fica negativo', () => {
    expect(msRestantes(t0, t0 + 60_000)).toBe(PRAZO_MS - 60_000);
    expect(msRestantes(t0, t0 + PRAZO_MS + 5)).toBe(0);
    expect(msRestantes(null, t0)).toBe(PRAZO_MS);
  });
});
