import { describe, it, expect } from 'vitest';
import { formatCPF } from './cpf';

describe('cpf', () => {
  it('formatCPF aplica a máscara progressivamente', () => {
    expect(formatCPF('529')).toBe('529');
    expect(formatCPF('5299')).toBe('529.9');
    expect(formatCPF('5299822')).toBe('529.982.2');
    expect(formatCPF('52998224725')).toBe('529.982.247-25');
  });

  it('formatCPF ignora não-dígitos e trunca em 11', () => {
    expect(formatCPF('529.982.247-25extra')).toBe('529.982.247-25');
  });
});
