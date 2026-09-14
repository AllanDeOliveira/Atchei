import { storageRef } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { authStore } from './auth';

export const fileStore = {
  uploadFile: async (file: File, folder: string): Promise<string> => {
    try {
      const currentUser = authStore.getCurrentUser();
      const userId = currentUser ? currentUser.id : 'guest';
      const fileRef = ref(storageRef, `${folder}/${userId}/${Date.now()}_${file.name}`);
      // O nome leva timestamp, então o objeto nunca muda: cache de 1 ano no aparelho.
      // Sem isso o Storage responde max-age=0 e cada abertura do feed baixa todos os
      // pôsteres de novo, pagando egress a cada visita.
      await uploadBytes(fileRef, file, { cacheControl: 'public, max-age=31536000, immutable' });
      const url = await getDownloadURL(fileRef);
      return url;
    } catch (error) {
      console.error("Erro ao fazer upload do arquivo:", error);
      throw error;
    }
  }
};
