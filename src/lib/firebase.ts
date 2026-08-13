import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, inMemoryPersistence, browserPopupRedirectResolver } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getAnalytics, isSupported } from 'firebase/analytics';
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
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storageRef = getStorage(app);

// O GA4 só coleta depois desta inicialização — o measurementId na config sozinho não
// envia nada. isSupported() evita crash em navegadores/webviews sem suporte.
isSupported().then((ok) => { if (ok) getAnalytics(app); });

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

// ─── App SECUNDÁRIO isolado para a recuperação de ingressos via email-link ───
// A recuperação autentica o visitante por link mágico só para provar posse do
// e-mail. Se usássemos a instância principal do auth, o AuthContext trataria o
// visitante como logado no app inteiro (sync de perfil, token de push, navbar).
// Uma segunda FirebaseApp com auth EFÊMERO (inMemoryPersistence: não grava sessão
// em disco) mantém esse fluxo totalmente isolado da sessão principal.
let recoveryApp: ReturnType<typeof initializeApp> | null = null;
let recoveryAuthInstance: ReturnType<typeof initializeAuth> | null = null;
let recoveryFunctionsInstance: Functions | null = null;

const getRecoveryApp = () => {
  if (!recoveryApp) {
    recoveryApp = initializeApp(firebaseConfig, 'ticket-recovery');
  }
  return recoveryApp;
};

export const getRecoveryAuth = () => {
  if (!recoveryAuthInstance) {
    // popupRedirectResolver é obrigatório aqui: initializeAuth (ao contrário de
    // getAuth) não injeta o resolver de popup/redirect sozinho, e sem ele o
    // signInWithPopup do Google lança auth/argument-error.
    recoveryAuthInstance = initializeAuth(getRecoveryApp(), {
      persistence: inMemoryPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  }
  return recoveryAuthInstance;
};

export const getRecoveryFunctionsInstance = (): Functions => {
  if (!recoveryFunctionsInstance) {
    recoveryFunctionsInstance = getFunctions(getRecoveryApp());
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost && import.meta.env.VITE_USE_EMULATORS === 'true') {
      connectFunctionsEmulator(recoveryFunctionsInstance, '127.0.0.1', 5001);
    }
  }
  return recoveryFunctionsInstance;
};

