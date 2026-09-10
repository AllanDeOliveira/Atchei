import { describe, it, expect } from 'vitest';
import { estadoDesafio, msRestantes, PRAZO_MS, CARENCIA_MS, TAMANHO_GRUPO } from './desafio';

const membros = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);
const mesa = (n: number, iniciadoEmMs: number | null, entregueEmMs: number | null = null) =>
  ({ membros: membros(n), iniciadoEmMs, entregueEmMs });
const t0 = 1_700_000_000_000;
// Desafio aberto pelo admin, salvo no teste que trata o contrário.
const estado = (d: Parameters<typeof estadoDesafio>[0], agoraMs: number) => estadoDesafio(d, agoraMs, true);

describe('estadoDesafio', () => {
  it('desafio desligado pelo admin: fechado, mesmo com mesa em jogo', () => {
    expect(estadoDesafio(null, t0, false)).toBe('fechado');
    expect(estadoDesafio(mesa(5, t0 - 10_000), t0, false)).toBe('fechado');
  });

  it('sem documento: livre', () => {
    expect(estado(null, t0)).toBe('livre');
  });

  it('recém-iniciado (timestamp do servidor pendente): aberto', () => {
    expect(estado(mesa(1, null), t0)).toBe('aberto');
  });

  it('dentro do prazo com menos de 5: aberto', () => {
    expect(estado(mesa(3, t0), t0 + PRAZO_MS - 1)).toBe('aberto');
  });

  it('com 5 no grupo: liberado e NÃO caduca (mesa queimada)', () => {
    expect(estado(mesa(5, t0), t0 + 1000)).toBe('liberado');
    expect(estado(mesa(5, t0), t0 + PRAZO_MS + CARENCIA_MS)).toBe('liberado');
    expect(estado(mesa(5, t0), t0 + 24 * 60 * 60 * 1000)).toBe('liberado');
  });

  it('depois da entrega: entregue (comprovante queimado)', () => {
    expect(estado(mesa(5, t0, t0 + 90_000), t0 + 120_000)).toBe('entregue');
  });

  it('prazo estourado sem 5: expirado durante toda a carência', () => {
    expect(estado(mesa(4, t0), t0 + PRAZO_MS)).toBe('expirado');
    expect(estado(mesa(4, t0), t0 + PRAZO_MS + CARENCIA_MS - 1)).toBe('expirado');
  });

  it('mesa que NÃO fechou volta a ficar livre após prazo + carência', () => {
    expect(estado(mesa(4, t0), t0 + PRAZO_MS + CARENCIA_MS)).toBe('livre');
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
