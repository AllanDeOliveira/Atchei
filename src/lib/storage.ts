import { auth, db, storageRef } from './firebase';
import { USER_KEY } from './storageKeys';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
  startAfter,
  orderBy
} from 'firebase/firestore';
import type { Timestamp, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  updatePassword,
  sendEmailVerification
} from 'firebase/auth';

export interface AppProfile {
  id: string;
  name: string;
  // 'atletica'/'estabelecimento' foram fundidos em 'profissional'; docs antigos no
  // Firestore ainda podem carregar os valores legados — trate qualquer tipo que não
  // seja 'user'/'admin' como profissional.
  type: 'user' | 'profissional' | 'admin';
  description: string;
  imageUrl?: string;
  email?: string;
  password?: string;
  mustChangePassword?: boolean;
  instagram?: string;
  /** Data de nascimento (YYYY-MM-DD). Cadastros exigem 18+; docs antigos não têm o campo. */
  birthDate?: string;
};

export type User = {
  id: string;
  name: string;
  username: string;
  role: 'user' | 'partner' | 'admin';
  mustChangePassword?: boolean;
  imageUrl?: string;
  profileId?: string;
};

export interface TicketType {
  id: string;
  name: string;
  price: number;
  capacity: number;
  /** Legado: os vendidos moram em EventItem.soldByTicket (só o backend escreve). */
  sold?: number;
  status: 'active' | 'sold_out';
}

export type EventCategory = 'Festa' | 'Universitário' | 'Show' | 'Esporte' | 'Gastronomia' | 'Cultural' | 'Outros';

export const EVENT_CATEGORIES: EventCategory[] = [
  'Festa',
  'Universitário',
  'Show',
  'Esporte',
  'Gastronomia',
  'Cultural',
  'Outros'
];

export type EventItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  address?: string;
  mediaUrls?: string[];
  publicType: 'Aberto' | 'Geral' | 'Universitário';
  category?: EventCategory;
  description: string;
  creatorId: string;
  hasTickets?: boolean;
  hasPixTickets?: boolean;
  ticketPrice?: string;
  pixTicketPrice?: string;
  whatsappContacts?: { name: string; phone: string }[];
  isTestEvent?: boolean;
  registrationCount?: number;
  tickets?: TicketType[]; // Múltiplos tipos de ingressos e lotes
  /** Vendidos por lote, gerido SÓ pelo backend (rules bloqueiam escrita do cliente). */
  soldByTicket?: { [ticketId: string]: number };
  hasPresence?: boolean;
};

/** Evento expira só no fim do seu dia: visível durante todo o dia da data marcada. */
export const eventoVigente = (e: Pick<EventItem, 'date'>): boolean => {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  return new Date(`${e.date}T00:00`) >= inicioHoje;
};

/** Vendidos de um lote — fonte única, escrita só pelo backend. */
export const soldCount = (event: Pick<EventItem, 'soldByTicket'>, ticket: Pick<TicketType, 'id'>): number =>
  event.soldByTicket?.[ticket.id] ?? 0;

/** Intenção de compra via WhatsApp: entra na lista do vendedor sem valer como ingresso.
 *  Vira ingresso quando o vendedor confirma o pagamento (STATUS_PAGO_WHATSAPP). */
export const STATUS_AGUARDANDO = 'Aguardando pagamento';
export const STATUS_PAGO_WHATSAPP = 'Pago (WhatsApp)';

export type Registration = {
  id: string;
  eventId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userPhone?: string;
  userCpf?: string;
  paymentStatus?: string;
  timestamp: string;
  ticketTypeId?: string;   // ID do tipo de ingresso (lote) adquirido
  ticketTypeName?: string; // Nome do tipo de ingresso (lote) adquirido
  pedidoId?: string;       // ID do pedido de pagamento
  checkedIn?: boolean;     // Ingresso já validado na portaria?
  checkedInAt?: string;    // Quando foi validado (ISO)
  checkedInBy?: string;    // Quem validou (nome do operador)
  isTeste?: boolean;       // Ingresso de teste (gerado por admin, fora do faturamento real)
};

// Pedido de pagamento (Pix via Asaas). Criado e alterado exclusivamente pelas
// Cloud Functions; o cliente apenas lê (dono do pedido, admin ou criador do evento).
export type Pedido = {
  id: string;
  valor: number;
  eventId: string;
  eventTitle?: string;
  userId: string;
  clienteNome?: string;
  clienteEmail?: string;
  // pendente | pago | estornado | chargeback | cancelado | rejeitado
  status: string;
  itensComprados?: { id: string; name?: string; quantity: number }[];
  // Split: `split: false` = cobrança sem recebedor cadastrado (tudo na plataforma).
  // Os valores em reais são ESTIMATIVAS sobre o bruto — o Asaas reparte sobre o
  // netValue (bruto − tarifa dele), então o repasse exato só é conhecido na liquidação.
  split?: boolean;
  splitPercentualOrganizador?: number;
  applicationFee?: number;
  valorLiquidoOrganizador?: number;
  overbooked?: boolean;
  isTeste?: boolean; // Pedido de teste (gerado por admin) — não entra no faturamento real
  dataCriacao?: Timestamp | null;
  dataPagamento?: Timestamp | null;
  dataEstorno?: Timestamp | null;
};

export const storage = {
  // Profiles
  getProfiles: async (limitCount: number = 50): Promise<AppProfile[]> => {
    const q = query(collection(db, 'profiles'), limit(limitCount));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppProfile));
  },

  // Diretório público (busca de visitante): só perfis profissionais — as rules negam
  // listagem irrestrita sem login; docs legados ('atletica'/'estabelecimento') contam.
  getPublicProfiles: async (limitCount: number = 50): Promise<AppProfile[]> => {
    const q = query(
      collection(db, 'profiles'),
      where('type', 'in', ['profissional', 'atletica', 'estabelecimento']),
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

  deleteProfile: async (id: string) => {
    await deleteDoc(doc(db, 'profiles', id));
  },

  updateProfile: async (id: string, data: Partial<AppProfile>) => {
    await updateDoc(doc(db, 'profiles', id), data);
  },
  // Events
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
      let profile = await storage.getProfileById(fbUser.uid);
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
    const currentUser = storage.getCurrentUser();
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

        const currentUser = storage.getCurrentUser();
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

  getRegistrationsForEvent: async (eventId: string): Promise<Registration[]> => {
    const q = query(collection(db, 'registrations'), where('eventId', '==', eventId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Registration));
  },

  // Pedidos de pagamento de um evento (usado no painel financeiro do parceiro).
  // Filtra o status em memória para não exigir índice composto no Firestore.
  getPedidosForEvent: async (eventId: string): Promise<Pedido[]> => {
    const q = query(collection(db, 'pedidos'), where('eventId', '==', eventId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pedido));
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
   *  As rules só aceitam esta transição (Aguardando → Pago) pelo dono do evento. */
  confirmRegistrationPayment: async (id: string): Promise<void> => {
    await updateDoc(doc(db, 'registrations', id), { paymentStatus: STATUS_PAGO_WHATSAPP });
  },

  uploadFile: async (file: File, folder: string): Promise<string> => {
    try {
      const currentUser = storage.getCurrentUser();
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


