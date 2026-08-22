// Chaves do localStorage, num lugar só.
//
// O prefixo era "@chain:" enquanto o projeto se chamava Chain. Renomear para
// "@atchei:" sem mais nada deixaria a sessão de quem já usa o app presa na chave
// antiga — na prática, um logout em massa no primeiro deploy. Por isso
// migrateLegacyStorageKeys() copia o valor de cada chave legada uma única vez,
// na inicialização, antes de qualquer leitura.
const LEGACY_PREFIX = '@chain:';
const PREFIX = '@atchei:';

export const USER_KEY = `${PREFIX}user`;
export const INSTALL_DISMISS_KEY = `${PREFIX}install-dismissed`;
export const RECOVERY_EMAIL_KEY = `${PREFIX}recoveryEmail`;

const MIGRATED_KEYS = [USER_KEY, INSTALL_DISMISS_KEY, RECOVERY_EMAIL_KEY];

/**
 * Move os valores de "@chain:*" para "@atchei:*". Idempotente: rodar de novo não
 * faz nada, porque a chave legada já foi removida. Se a chave nova já existir,
 * ela vence — o dado mais recente é o que o app gravou depois do rename.
 */
export function migrateLegacyStorageKeys(): void {
  try {
    for (const key of MIGRATED_KEYS) {
      const legacyKey = LEGACY_PREFIX + key.slice(PREFIX.length);
      const legacyValue = localStorage.getItem(legacyKey);
      if (legacyValue === null) continue;
      if (localStorage.getItem(key) === null) {
        localStorage.setItem(key, legacyValue);
      }
      localStorage.removeItem(legacyKey);
    }
  } catch {
    // localStorage indisponível (aba privada, cookies bloqueados). Sem migração,
    // o app segue normalmente — só perde a sessão antiga, que nesse modo já não existe.
  }
}
