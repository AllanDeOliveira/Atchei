import { storageRef } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { authStore } from './auth';

export const fileStore = {
  uploadFile: async (file: File, folder: string): Promise<string> => {
    try {
      const currentUser = authStore.getCurrentUser();
      const userId = currentUser ? currentUser.id : 'guest';
      const fileRef = ref(storageRef, `${folder}/${userId}/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);
      return url;
    } catch (error) {
      console.error("Erro ao fazer upload do arquivo:", error);
      throw error;
    }
  }
};
