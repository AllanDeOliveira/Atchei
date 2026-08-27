import { auth, db } from '../firebase';
import { USER_KEY } from '../storageKeys';
import {
  collection,
  getDocs,
  setDoc,
  doc,
  query,
  where,
  updateDoc
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  updatePassword,
  sendEmailVerification
} from 'firebase/auth';
import type { AppProfile, User } from './types';
import { profileStore } from './profiles';

export const authStore = {
  // Auth (Sessão mantida localmente para rapidez, sincronizada com Firebase)
  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(USER_KEY);
    if (!data) return null;
    const user = JSON.parse(data);
    if (!user.role) user.role = 'user';
    return user;
  },

  // Perfil 'user' (pessoal) participa de eventos; 'profissional' também vende
  // ingressos e cadastra a conta de recebimento Asaas (vira role 'partner').
  register: async (email: string, password: string, name: string, type: 'user' | 'profissional' = 'user', birthDate?: string): Promise<User | null> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const fbUser = userCredential.user;

      // E-mail de verificação: typo no cadastro inviabiliza recuperar ingresso depois.
      // Não bloqueia o uso — o Perfil mostra aviso enquanto não verificar.
      sendEmailVerification(fbUser).catch((e) => console.warn('Falha ao enviar verificação de e-mail:', e));

      const user: User = {
        id: fbUser.uid,
        name,
        username: email,
        role: type === 'user' ? 'user' : 'partner',
        mustChangePassword: false,
      };

      await setDoc(doc(db, 'profiles', fbUser.uid), {
        name,
        email,
        type,
        mustChangePassword: false,
        ...(birthDate ? { birthDate } : {})
      });

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

      // Buscar perfil no Firestore para saber a role
      // Tenta buscar por ID ou por Email
      let profile = await profileStore.getProfileById(fbUser.uid);
      if (!profile) {
        const q = query(collection(db, 'profiles'), where('email', '==', email));
        const qs = await getDocs(q);
        if (!qs.empty) {
          profile = { id: qs.docs[0].id, ...qs.docs[0].data() } as AppProfile;
        }
      }

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
    await signOut(auth);
    localStorage.removeItem(USER_KEY);
  },

  updatePartnerPassword: async (partnerId: string, newPassword: string) => {
    // O partnerId aqui é o UID do Firebase Auth, mas o doc no Firestore
    // foi criado com um ID diferente (p12345...). Buscar pelo email.
    const currentUser = authStore.getCurrentUser();
    const email = currentUser?.username;

    if (email) {
      // Buscar o documento do perfil pelo email
      const q = query(collection(db, 'profiles'), where('email', '==', email));
      const qs = await getDocs(q);

      if (!qs.empty) {
        const profileDocRef = qs.docs[0].ref;
        await updateDoc(profileDocRef, {
          mustChangePassword: false
        });
      }
    }

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

  updatePartnerProfile: async (email: string, updates: Partial<AppProfile>): Promise<AppProfile | null> => {
    try {
      const q = query(collection(db, 'profiles'), where('email', '==', email));
      const qs = await getDocs(q);
      if (!qs.empty) {
        const docRef = qs.docs[0].ref;
        await updateDoc(docRef, updates);

        const currentUser = authStore.getCurrentUser();
        if (currentUser && currentUser.username === email) {
          const updatedUser = {
            ...currentUser,
            name: updates.name || currentUser.name,
            imageUrl: updates.imageUrl !== undefined ? updates.imageUrl : currentUser.imageUrl
          };
          localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
        }

        return { id: qs.docs[0].id, ...qs.docs[0].data(), ...updates } as AppProfile;
      }
      return null;
    } catch (error) {
      console.error("Erro ao atualizar o perfil do parceiro:", error);
      return null;
    }
  },

  getProfileByEmail: async (email: string): Promise<AppProfile | null> => {
    try {
      const q = query(collection(db, 'profiles'), where('email', '==', email));
      const qs = await getDocs(q);
      if (!qs.empty) {
        return { id: qs.docs[0].id, ...qs.docs[0].data() } as AppProfile;
      }
      return null;
    } catch (e) {
      console.error("Erro ao buscar perfil por email:", e);
      return null;
    }
  },
};
