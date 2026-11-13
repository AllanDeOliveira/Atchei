import { db } from '../firebase';
import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  addDoc,
  deleteDoc,
  query,
  where,
  updateDoc,
  limit,
  startAfter
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import type { Registration } from './types';
import { STATUS_PAGO_WHATSAPP } from './types';

export const registrationStore = {
  // Registrations (Inscrições/Presenças)
  getRegistrations: async (): Promise<Registration[]> => {
    const querySnapshot = await getDocs(collection(db, 'registrations'));
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
  },

  getRegistrationsForUser: async (userId: string): Promise<Registration[]> => {
    const q = query(collection(db, 'registrations'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
  },

  saveRegistration: async (registration: Registration): Promise<string> => {
    const { id, ...data } = registration;
    void id; // o id é gerado pelo Firestore; descartado do payload de escrita
    const docRef = await addDoc(collection(db, 'registrations'), data);
    return docRef.id;
  },

  /** Inscrição em nome PRÓPRIO (presença gratuita ou intenção WhatsApp).
   *  O id é determinístico (eventId_userId) para as rules garantirem no servidor
   *  um único doc por pessoa por evento — com addDoc, um script poderia inflar a
   *  lista do organizador (e a prova social) criando N inscrições. */
  saveSelfRegistration: async (registration: Registration): Promise<string> => {
    const { id, ...data } = registration;
    void id; // o id é derivado de eventId+userId; descartado do payload de escrita
    const docId = `${registration.eventId}_${registration.userId}`;
    await setDoc(doc(db, 'registrations', docId), data);
    return docId;
  },

  getRegistrationsForEvent: async (eventId: string): Promise<Registration[]> => {
    const q = query(collection(db, 'registrations'), where('eventId', '==', eventId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
  },

  // Busca um ingresso/inscrição pelo ID do documento (usado na leitura do QR Code)
  getRegistrationById: async (id: string): Promise<Registration | null> => {
    const trimmed = (id || '').trim();
    if (!trimmed) return null;
    try {
      const docSnap = await getDoc(doc(db, 'registrations', trimmed));
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Registration;
      }
      return null;
    } catch (error) {
      console.error('Erro ao buscar inscrição por ID:', error);
      return null;
    }
  },

  // Marca um ingresso como validado/usado (check-in na portaria)
  checkInRegistration: async (id: string, byName?: string): Promise<void> => {
    await updateDoc(doc(db, 'registrations', id), {
      checkedIn: true,
      checkedInAt: new Date().toISOString(),
      checkedInBy: byName || '',
    });
  },

  // Busca inscrições paginadas de um evento específico para otimizar desempenho e custo
  getPaginatedRegistrationsForEvent: async (eventId: string, lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null = null, pageSize: number = 20) => {
    const regsRef = collection(db, 'registrations');
    const q = lastVisibleDoc
      ? query(
          regsRef,
          where('eventId', '==', eventId),
          startAfter(lastVisibleDoc),
          limit(pageSize)
        )
      : query(
          regsRef,
          where('eventId', '==', eventId),
          limit(pageSize)
        );

    const querySnapshot = await getDocs(q);
    const registrations = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
    const lastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;

    return { registrations, lastDoc };
  },

  /** Inscrição do usuário neste evento (com id real), ou null. */
  getUserRegistration: async (eventId: string, userId: string): Promise<Registration | null> => {
    const q = query(
      collection(db, 'registrations'),
      where('eventId', '==', eventId),
      where('userId', '==', userId)
    );
    const qs = await getDocs(q);
    if (qs.empty) return null;
    return { id: qs.docs[0].id, ...qs.docs[0].data() } as Registration;
  },

  /** Cancela a própria presença gratuita (rules bloqueiam paga/pós-check-in). */
  deleteRegistration: async (id: string) => {
    await deleteDoc(doc(db, 'registrations', id));
  },

  /** Vendedor confirma o pagamento de uma intenção de compra via WhatsApp.
   *  As rules só aceitam esta transição (Aguardando → Pago) pelo dono do evento, e
   *  exigem o ticketSecret: o id da intenção (eventId_uid) sai de dados públicos e
   *  não pode ser a credencial da portaria. */
  confirmRegistrationPayment: async (id: string): Promise<void> => {
    await updateDoc(doc(db, 'registrations', id), {
      paymentStatus: STATUS_PAGO_WHATSAPP,
      ticketSecret: crypto.randomUUID(),
    });
  },
};
