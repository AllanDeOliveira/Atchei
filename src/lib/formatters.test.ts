import { describe, it, expect } from 'vitest';
import { formatPhone, formatCPF, celulaCsv } from './formatters';

describe('formatters', () => {
  describe('celulaCsv', () => {
    it('protege separador, aspas e quebra de linha, e neutraliza fórmula do Excel', () => {
      expect(celulaCsv('Silva; "Ju"')).toBe('"Silva; ""Ju"""');
      expect(celulaCsv('linha1\nlinha2')).toBe('"linha1\nlinha2"');
      expect(celulaCsv('=1+1')).toBe('"\'=1+1"');
      expect(celulaCsv('')).toBe('""');
    });
  });

  describe('formatPhone', () => {
    it('deve formatar telefone com 11 dígitos corretamente', () => {
      expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
    });

    it('deve formatar telefone com 10 dígitos (fixo)', () => {
      expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    });

    it('deve lidar com valores parciais ou vazios', () => {
      expect(formatPhone('')).toBe('');
      expect(formatPhone('11')).toBe('(11');
      expect(formatPhone('1198')).toBe('(11) 98');
    });
  });

  describe('re-exports de CPF', () => {
    it('deve reexportar formatCPF corretamente', () => {
      expect(formatCPF('12345678901')).toBe('123.456.789-01');
    });
  });
});
