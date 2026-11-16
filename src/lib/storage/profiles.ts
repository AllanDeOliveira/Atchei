import { db } from '../firebase';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  updateDoc,
  limit,
  writeBatch
} from 'firebase/firestore';
import type { AppProfile } from './types';

export const profileStore = {
  /** Painel admin (as rules só deixam admin listar tudo): perfis com o e-mail de
   *  login, que mora em profilesPrivate. */
  getProfiles: async (limitCount: number = 50): Promise<AppProfile[]> => {
    const [perfis, privados] = await Promise.all([
      getDocs(query(collection(db, 'profiles'), limit(limitCount))),
      getDocs(collection(db, 'profilesPrivate')),
    ]);
    const emails = new Map(privados.docs.map(d => [d.id, d.get('email') as string | undefined]));
    return perfis.docs.map(d => ({ id: d.id, ...d.data(), email: emails.get(d.id) } as AppProfile));
  },

  // Diretório público (busca de visitante): só perfis profissionais — as rules negam
  // listagem irrestrita sem login.
  getPublicProfiles: async (limitCount: number = 50): Promise<AppProfile[]> => {
    const q = query(
      collection(db, 'profiles'),
      where('type', '==', 'profissional'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppProfile));
  },

  getProfileById: async (id: string): Promise<AppProfile | undefined> => {
    const docSnap = await getDoc(doc(db, 'profiles', id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as AppProfile;
    }
    return undefined;
  },

  /** Cria o perfil (id = uid). E-mail e nascimento vão para profilesPrivate no mesmo
   *  batch: o perfil profissional é público, e as rules do create exigem os dois juntos. */
  saveProfile: async (profile: AppProfile, privado: { email: string; birthDate?: string }) => {
    const batch = writeBatch(db);
    batch.set(doc(db, 'profiles', profile.id), {
      name: profile.name,
      type: profile.type,
      description: profile.description || '',
      imageUrl: profile.imageUrl || '',
      mustChangePassword: profile.mustChangePassword ?? false
    });
    batch.set(doc(db, 'profilesPrivate', profile.id), privado);
    await batch.commit();
  },

  updateProfile: async (id: string, data: Partial<AppProfile>) => {
    await updateDoc(doc(db, 'profiles', id), data);
  },
};
