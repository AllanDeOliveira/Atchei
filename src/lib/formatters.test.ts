import { describe, it, expect } from 'vitest';
import { formatPhone, isValidEmail, formatCPF, isValidCPF } from './formatters';

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

  describe('isValidEmail', () => {
    it('deve aceitar e-mails válidos', () => {
      expect(isValidEmail('usuario@teste.com')).toBe(true);
      expect(isValidEmail('aluno.exemplo@universidade.edu.br')).toBe(true);
    });

    it('deve rejeitar e-mails inválidos ou vazios', () => {
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail('invalido')).toBe(false);
      expect(isValidEmail('@semusuario.com')).toBe(false);
      expect(isValidEmail('semdominio@')).toBe(false);
    });
  });

  describe('re-exports de CPF', () => {
    it('deve reexportar formatCPF e isValidCPF corretamente', () => {
      expect(formatCPF('12345678901')).toBe('123.456.789-01');
      expect(isValidCPF('00000000000')).toBe(false);
    });
  });
});
