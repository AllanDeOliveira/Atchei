import { profileStore } from './profiles';
import { eventStore } from './events';
import { authStore } from './auth';
import { registrationStore } from './registrations';
import { fileStore } from './files';

// Tipos, constantes e helpers de domínio (AppProfile, EventItem, Registration,
// Pedido, soldCount, STATUS_*, EVENT_CATEGORIES, eventoVigente...).
export * from './types';

/**
 * Fachada única de acesso a dados. Reúne os stores por domínio num só objeto:
 * os componentes seguem importando `{ storage }` e chamando `storage.getEvents()`,
 * `storage.login()` etc. sem saber que por baixo são módulos separados
 * (profiles / events / auth / registrations+pedidos / files).
 */
export const storage = {
  ...profileStore,
  ...eventStore,
  ...authStore,
  ...registrationStore,
  ...fileStore,
};
