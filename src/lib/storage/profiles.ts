import { db } from '../firebase';
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  where,
  updateDoc,
  limit
} from 'firebase/firestore';
import type { AppProfile } from './types';

export const profileStore = {
  getProfiles: async (limitCount: number = 50): Promise<AppProfile[]> => {
    const q = query(collection(db, 'profiles'), limit(limitCount));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppProfile));
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

  saveProfile: async (profile: AppProfile) => {
    await setDoc(doc(db, 'profiles', profile.id), {
      name: profile.name,
      type: profile.type,
      description: profile.description,
      imageUrl: profile.imageUrl || '',
      email: profile.email || '',
      mustChangePassword: profile.mustChangePassword ?? false
    });
  },

  updateProfile: async (id: string, data: Partial<AppProfile>) => {
    await updateDoc(doc(db, 'profiles', id), data);
  },
};
