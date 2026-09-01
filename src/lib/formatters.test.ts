import { describe, it, expect } from 'vitest';
import { formatPhone, formatCPF } from './formatters';

describe('formatters', () => {
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
