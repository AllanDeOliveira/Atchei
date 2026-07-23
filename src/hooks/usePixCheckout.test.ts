import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePixCheckout } from './usePixCheckout';

describe('usePixCheckout', () => {
  it('deve inicializar com o estado correto', () => {
    const { result } = renderHook(() => usePixCheckout());
    expect(result.current.showPixModal).toBe(false);
    expect(result.current.pixStep).toBe('buyer_info');
    expect(result.current.pixSecondsLeft).toBe(600);
    expect(result.current.pixExpired).toBe(false);
  });

  it('deve validar dados de comprador corretamente', () => {
    const { result } = renderHook(() => usePixCheckout());

    // Tentativa com dados vazios
    act(() => {
      const isValid = result.current.validateBuyer();
      expect(isValid).toBe(false);
    });
    expect(result.current.pixErrors.name).toBeDefined();

    // Preenchendo dados válidos (CPF válido hipotético)
    act(() => {
      result.current.setBuyerInfo({
        name: 'Maria Silva',
        email: 'maria@exemplo.com',
        phone: '11987654321',
        cpf: '00000000000', // Inválido por dígitos repetidos
      });
    });

    act(() => {
      const isValid = result.current.validateBuyer();
      expect(isValid).toBe(false);
    });
    expect(result.current.pixErrors.cpf).toBe('CPF inválido.');
  });

  it('deve formatar os segundos restantes corretamente', () => {
    const { result } = renderHook(() => usePixCheckout());
    expect(result.current.formatSecondsLeft(600)).toBe('10:00');
    expect(result.current.formatSecondsLeft(65)).toBe('01:05');
    expect(result.current.formatSecondsLeft(0)).toBe('00:00');
  });

  it('deve resetar o checkout', () => {
    const { result } = renderHook(() => usePixCheckout());
    
    act(() => {
      result.current.setShowPixModal(true);
      result.current.setPixStep('qr_code');
      result.current.resetPixCheckout();
    });

    expect(result.current.showPixModal).toBe(false);
    expect(result.current.pixStep).toBe('buyer_info');
  });

  it('deve calcular os segundos restantes com base em timestamp absoluto', () => {
    const { result } = renderHook(() => usePixCheckout());

    act(() => {
      result.current.setShowPixModal(true);
      result.current.setPixStep('qr_code');
      result.current.setExpirationTimestamp(Date.now() + 120000); // 120s no futuro
    });

    expect(result.current.pixSecondsLeft).toBeLessThanOrEqual(120);
    expect(result.current.pixSecondsLeft).toBeGreaterThan(115);
  });
});
