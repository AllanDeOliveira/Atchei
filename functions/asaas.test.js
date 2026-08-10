import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { calcSplit } = require('./asaas');

// Caminho do dinheiro: errar aqui tira do organizador ou da plataforma sem ninguém ver.
// Atenção à inversão em relação ao Mercado Pago — o split declara o que VAI para o
// organizador, não a comissão retida.
describe('calcSplit', () => {
  it('devolve o percentual de repasse ao organizador', () => {
    expect(calcSplit(100, 10).percentualOrganizador).toBe(90);
    expect(calcSplit(50, 7.5).percentualOrganizador).toBe(92.5);
    expect(calcSplit(50, 0).percentualOrganizador).toBe(100);
  });

  // O Asaas valida o split contra o netValue e aceita no máximo 100%. Um percentual
  // fora de [0, 100] faz a cobrança inteira ser recusada.
  it('mantém o percentual sempre dentro de 0–100', () => {
    for (const pct of [-50, 0, 1, 50, 99.99, 100, 150, 1000]) {
      const { percentualOrganizador } = calcSplit(100, pct);
      expect(percentualOrganizador).toBeGreaterThanOrEqual(0);
      expect(percentualOrganizador).toBeLessThanOrEqual(100);
    }
  });

  it('respeita o limite de 4 casas decimais do Asaas', () => {
    const { percentualOrganizador } = calcSplit(100, 7.123456);
    expect(percentualOrganizador).toBe(92.8765);
    expect(String(percentualOrganizador).split('.')[1]?.length ?? 0).toBeLessThanOrEqual(4);
  });

  it('comissão de 100% não gera repasse (sem split)', () => {
    expect(calcSplit(100, 100)).toEqual({ percentualOrganizador: 0, feeEstimada: 0, repasseEstimado: 0 });
  });

  it('valor inválido não gera repasse', () => {
    expect(calcSplit(0, 10).percentualOrganizador).toBe(0);
    expect(calcSplit(-5, 10).percentualOrganizador).toBe(0);
  });

  // Estimativas para o painel: são sobre o bruto, e as duas partes têm que fechar a conta.
  it('as estimativas em reais sempre somam o valor cobrado', () => {
    for (const valor of [10, 19.99, 33.33, 47.77, 150.55, 999.99]) {
      for (const pct of [3, 7.5, 10, 12.35]) {
        const { feeEstimada, repasseEstimado } = calcSplit(valor, pct);
        expect(Math.round((feeEstimada + repasseEstimado) * 100) / 100).toBe(valor);
      }
    }
  });
});
