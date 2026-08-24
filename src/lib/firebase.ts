import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAnalytics, isSupported, setConsent } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import type { Functions } from 'firebase/functions';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

// App Check (reCAPTCHA v3): atesta que as chamadas a Firestore/Functions vêm do app
// legítimo. Em dev, o debug token (impresso no console na 1ª execução) precisa ser
// registrado em Firebase Console → App Check → Apps → Gerenciar tokens de depuração.
const appCheckSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (appCheckSiteKey && !import.meta.env.TEST) {
  if (import.meta.env.DEV) {
    (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(app);
// E-mails de verificação/redefinição saem no template pt-BR do Firebase.
auth.languageCode = 'pt';
export const db = getFirestore(app);
export const storageRef = getStorage(app);

export const COOKIE_CONSENT_KEY = 'atchei:cookie-consent';

/**
 * Consent Mode v2. O GA4 sobe sempre, mas o estado de consentimento decide COMO:
 * - negado (padrão): medição sem cookie — pings agregados, sem identificador e sem
 *   rastreio entre sites. Base legal: legítimo interesse (art. 7º, IX), no espírito
 *   do guia da ANPD para medição de audiência própria e não invasiva.
 * - aceito: cookies `_ga` e medição completa (art. 7º, I — consentimento).
 * Publicidade fica NEGADA nos dois casos: o Atchei não faz ads nem perfilamento.
 */
export const aplicarConsentimento = (aceitouAnalytics: boolean) => {
  setConsent({
    analytics_storage: aceitouAnalytics ? 'granted' : 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
  });
};

// Estado inicial ANTES de qualquer coleta (senão o GA4 já teria gravado cookie).
aplicarConsentimento(
  typeof localStorage !== 'undefined' && localStorage.getItem(COOKIE_CONSENT_KEY) === 'all'
);
// isSupported() evita crash em navegadores/webviews sem suporte a GA.
//
// cookie_domain: 'none' fixa o cookie no host exato. Sem isso o GA4 tenta subir a
// árvore de domínios e chega em ".web.app", que está na Public Suffix List — o
// navegador recusa o cookie ("domínio inválido") e o _ga nunca persiste, fazendo
// cada visita ser contada como um usuário novo. Em domínio próprio isso não
// aparece; em <projeto>.web.app, sim.
isSupported().then((ok) => {
  if (ok) initializeAnalytics(app, { config: { cookie_domain: 'none' } });
});

// Instância única do Functions, com hookup do emulador em dev local.
// Lazy para que testes que mockam os módulos do Firebase não a inicializem.
let functionsInstance: Functions | null = null;
export const getFunctionsInstance = (): Functions => {
  if (!functionsInstance) {
    functionsInstance = getFunctions(app);
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost && import.meta.env.VITE_USE_EMULATORS === 'true') {
      connectFunctionsEmulator(functionsInstance, '127.0.0.1', 5001);
    }
  }
  return functionsInstance;
};

