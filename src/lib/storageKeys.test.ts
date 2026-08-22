import { describe, it, expect, beforeEach } from 'vitest';
import {
  migrateLegacyStorageKeys,
  USER_KEY,
  INSTALL_DISMISS_KEY,
  RECOVERY_EMAIL_KEY,
} from './storageKeys';

describe('migrateLegacyStorageKeys', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('move o valor da chave "@chain:*" para "@atchei:*" e apaga a antiga', () => {
    const user = JSON.stringify({ id: 'u1', name: 'Teste' });
    localStorage.setItem('@chain:user', user);
    localStorage.setItem('@chain:install-dismissed', '1');
    localStorage.setItem('@chain:recoveryEmail', 'a@b.com');

    migrateLegacyStorageKeys();

    expect(localStorage.getItem(USER_KEY)).toBe(user);
    expect(localStorage.getItem(INSTALL_DISMISS_KEY)).toBe('1');
    expect(localStorage.getItem(RECOVERY_EMAIL_KEY)).toBe('a@b.com');
    expect(localStorage.getItem('@chain:user')).toBeNull();
    expect(localStorage.getItem('@chain:install-dismissed')).toBeNull();
    expect(localStorage.getItem('@chain:recoveryEmail')).toBeNull();
  });

  // Sem isso, uma segunda execução sobrescreveria a sessão atual com um valor velho.
  it('preserva a chave nova quando as duas existem', () => {
    localStorage.setItem('@chain:user', 'antigo');
    localStorage.setItem(USER_KEY, 'atual');

    migrateLegacyStorageKeys();

    expect(localStorage.getItem(USER_KEY)).toBe('atual');
    expect(localStorage.getItem('@chain:user')).toBeNull();
  });

  it('é idempotente e não cria chave quando não há nada a migrar', () => {
    migrateLegacyStorageKeys();
    migrateLegacyStorageKeys();

    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
