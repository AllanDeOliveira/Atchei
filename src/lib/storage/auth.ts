import { auth, db } from '../firebase';
import { USER_KEY } from '../storageKeys';
import { doc, updateDoc } from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  updatePassword,
  GoogleAuthProvider,
  signInWithPopup,
  browserPopupRedirectResolver
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { getFunctionsInstance } from '../firebase';
import type { AppProfile, User } from './types';
import { profileStore } from './profiles';
import { disableNotifications } from '../notifications';

export const authStore = {
  // E-mail de verificação com template e página nossos (o Google bloqueia personalizar
  // os do Firebase neste projeto — o nativo cairia numa página em inglês).
  solicitarVerificacaoEmail: async (): Promise<void> => {
    await httpsCallable(getFunctionsInstance(), 'solicitarVerificacaoEmail')({});
  },

  /**
   * Login com Google (popup). Conta que ainda não tem perfil devolve `precisaCompletar`:
   * o cadastro pede só a data de nascimento (as rules exigem 18+) e cria o perfil.
   */
  loginComGoogle: async (): Promise<{ user: User } | { precisaCompletar: true; name: string; email: string }> => {
    // O resolvedor vai aqui porque o auth é criado sem ele (ver lib/firebase.ts).
    const cred = await signInWithPopup(auth, new GoogleAuthProvider(), browserPopupRedirectResolver);
    const fbUser = cred.user;
    const email = (fbUser.email || '').toLowerCase();

    const profile = await profileStore.getProfileById(fbUser.uid);
    if (!profile) return { precisaCompletar: true, name: fbUser.displayName || '', email };

    const user: User = {
      id: fbUser.uid,
      name: profile.name || fbUser.displayName || 'Usuário',
      username: email,
      role: profile.type === 'admin' ? 'admin' : ((profile.type as string) !== 'user' ? 'partner' : 'user'),
      mustChangePassword: profile.mustChangePassword ?? false,
      imageUrl: profile.imageUrl || '',
      profileId: profile.id,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return { user };
  },

  /** Conclui o cadastro de quem entrou com Google: cria o perfil pessoal (18+ validado nas rules). */
  completarCadastroGoogle: async (name: string, birthDate: string): Promise<User> => {
    const fbUser = auth.currentUser;
    if (!fbUser) throw new Error('Sessão do Google não encontrada.');
    const email = (fbUser.email || '').toLowerCase();
    await profileStore.saveProfile(
      { id: fbUser.uid, name, type: 'user', description: '', imageUrl: fbUser.photoURL || '', mustChangePassword: false },
      { email, birthDate },
    );
    const user: User = { id: fbUser.uid, name, username: email, role: 'user', mustChangePassword: false, imageUrl: fbUser.photoURL || '' };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  },

  // Auth (Sessão mantida localmente para rapidez, sincronizada com Firebase)
  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(USER_KEY);
    if (!data) return null;
    const user = JSON.parse(data);
    if (!user.role) user.role = 'user';
    return user;
  },

  // Perfil 'user' (pessoal) participa de eventos; 'profissional' também cria eventos
  // e vende ingressos (vira role 'partner').
  register: async (email: string, password: string, name: string, type: 'user' | 'profissional' = 'user', birthDate?: string): Promise<User | null> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = userCredential.user;

      // E-mail de verificação: typo no cadastro inviabiliza recuperar ingresso depois.
      // Não bloqueia o uso — o Perfil mostra aviso enquanto não verificar.
      authStore.solicitarVerificacaoEmail().catch((e) => console.warn('Falha ao enviar verificação de e-mail:', e));

      const user: User = {
        id: fbUser.uid,
        name,
        username: email,
        role: type === 'user' ? 'user' : 'partner',
        mustChangePassword: false,
      };

      await profileStore.saveProfile(
        { id: fbUser.uid, name, type, description: '', mustChangePassword: false },
        { email, ...(birthDate ? { birthDate } : {}) },
      );

      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      console.error("Erro no registro:", error);
      throw error;
    }
  },

  login: async (email: string, password?: string): Promise<User | null> => {
    try {
      // Usa exclusivamente Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password || '');
      const fbUser = userCredential.user;

      // Perfil no Firestore (id = uid) para saber a role
      const profile = await profileStore.getProfileById(fbUser.uid);

      const user: User = {
        id: fbUser.uid,
        name: profile?.name || fbUser.displayName || 'Usuário',
        username: email,
        role: profile?.type === 'admin' ? 'admin' : (profile && (profile.type as string) !== 'user' ? 'partner' : 'user'),
        mustChangePassword: profile?.mustChangePassword ?? false,
        imageUrl: profile?.imageUrl || '',
        profileId: profile?.id
      };

      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return user;
    } catch (error) {
      console.error("Erro no login:", error);
      return null;
    }
  },

  logout: async () => {
    // Antes do signOut (a rule de delete do token exige login): sem isso, quem usar o
    // navegador depois continua recebendo os pushes desta conta.
    await disableNotifications();
    await signOut(auth);
    localStorage.removeItem(USER_KEY);
  },

  updatePartnerPassword: async (partnerId: string, newPassword: string) => {
    const currentUser = authStore.getCurrentUser();
    await updateDoc(doc(db, 'profiles', partnerId), { mustChangePassword: false });

    // Atualizar a senha no Firebase Auth também
    if (auth.currentUser) {
      await updatePassword(auth.currentUser, newPassword);
    }

    // Atualizar a sessão local
    if (currentUser && currentUser.id === partnerId) {
      currentUser.mustChangePassword = false;
      localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    }
  },

  updatePartnerProfile: async (id: string, updates: Partial<AppProfile>): Promise<boolean> => {
    try {
      await updateDoc(doc(db, 'profiles', id), updates);
      const currentUser = authStore.getCurrentUser();
      if (currentUser && currentUser.id === id) {
        const updatedUser = {
          ...currentUser,
          name: updates.name || currentUser.name,
          imageUrl: updates.imageUrl !== undefined ? updates.imageUrl : currentUser.imageUrl
        };
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      }
      return true;
    } catch (error) {
      console.error("Erro ao atualizar o perfil do parceiro:", error);
      return false;
    }
  },
};
