import { initializeApp } from 'firebase/app';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
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
    // Token FIXO vindo do .env.local (VITE_APPCHECK_DEBUG_TOKEN): registre-o UMA vez
    // no console e todo dev desta máquina passa a contar como verificado. Sem a env,
    // cai no `true` (token aleatório por navegador — o que sujava a métrica).
    (self as { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
      import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
  }
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

// initializeAuth em vez de getAuth: o getAuth registra o resolvedor de popup/redirect, que no
// celular baixa /__/auth/iframe.js (~90 KB) e a gapi em toda visita, mesmo de quem nunca faz login
// (era a cadeia de rede mais longa da home). A lista de persistência é a mesma do getAuth, então
// ninguém é deslogado. O resolvedor entra só no signInWithPopup (storage/auth.ts).
export const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
});
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
//
// Só depois do `load`: o gtag (150 KB) deixa de disputar rede e CPU com a primeira pintura.
const iniciarAnalytics = () => {
  isSupported().then((ok) => {
    if (ok) initializeAnalytics(app, { config: { cookie_domain: 'none' } });
  });
};
if (document.readyState === 'complete') iniciarAnalytics();
else window.addEventListener('load', iniciarAnalytics, { once: true });

// Instância única do Functions. Lazy para que testes que mockam os módulos do
// Firebase não a inicializem.
let functionsInstance: Functions | null = null;
export const getFunctionsInstance = (): Functions => {
  functionsInstance ??= getFunctions(app);
  return functionsInstance;
};

