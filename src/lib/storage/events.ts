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
  limit,
  startAfter,
  orderBy
} from 'firebase/firestore';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import type { EventItem } from './types';

export const eventStore = {
  getEvents: async (limitCount: number = 50): Promise<EventItem[]> => {
    const q = query(collection(db, 'events'), limit(limitCount));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data } as EventItem;
    });
  },

  getPaginatedEvents: async (lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null = null, pageSize: number = 10) => {
    // en-CA formata como YYYY-MM-DD no fuso local.
    const todayStr = new Date().toLocaleDateString('en-CA');

    const eventsRef = collection(db, 'events');
    const q = lastVisibleDoc
      ? query(
          eventsRef,
          where('date', '>=', todayStr),
          orderBy('date', 'asc'),
          startAfter(lastVisibleDoc),
          limit(pageSize)
        )
      : query(
          eventsRef,
          where('date', '>=', todayStr),
          orderBy('date', 'asc'),
          limit(pageSize)
        );

    const querySnapshot = await getDocs(q);
    const events = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data } as EventItem;
    });
    const lastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null;

    return { events, lastDoc };
  },

  getUpcomingEvents: async (): Promise<EventItem[]> => {
    const todayStr = new Date().toLocaleDateString('en-CA');

    const eventsRef = collection(db, 'events');
    const q = query(
      eventsRef,
      where('date', '>=', todayStr),
      orderBy('date', 'asc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data } as EventItem;
    });
  },

  saveEvent: async (event: EventItem) => {
    const { id, ...eventData } = event;
    if (id && id.length > 5) { // Se tiver um ID real, atualiza
      // merge: preserva campos que o formulário não envia (ex.: registrationCount,
      // gerido pelas triggers) — sem isso o edit apagava o contador e as rules
      // recusariam a escrita por "alterar" campo protegido.
      await setDoc(doc(db, 'events', id), eventData, { merge: true });
    } else { // Senão, cria novo
      await addDoc(collection(db, 'events'), eventData);
    }
  },

  deleteEvent: async (id: string) => {
    await deleteDoc(doc(db, 'events', id));
  },

  getEventById: async (id: string): Promise<EventItem | undefined> => {
    const docSnap = await getDoc(doc(db, 'events', id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as EventItem;
    }
    return undefined;
  },

  getAgendaByProfileId: async (profileId: string): Promise<EventItem[]> => {
    const q = query(collection(db, 'events'), where('creatorId', '==', profileId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data } as EventItem;
    });
  },
};
