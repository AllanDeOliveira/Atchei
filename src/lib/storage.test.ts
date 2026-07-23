import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from './storage';

describe('storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getCurrentUser deve retornar null se localStorage estiver vazio', () => {
    expect(storage.getCurrentUser()).toBeNull();
  });

  it('getCurrentUser deve retornar o usuário armazenado no localStorage', () => {
    const mockUser = { id: 'u1', name: 'Teste', username: 'teste@exemplo.com', role: 'user' as const };
    localStorage.setItem('@atche:user', JSON.stringify(mockUser));
    expect(storage.getCurrentUser()).toEqual(mockUser);
  });
});
