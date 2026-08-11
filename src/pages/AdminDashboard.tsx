import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { storage } from '../lib/storage';
import { formatDateBR } from '../lib/formatters';
import type { EventItem, Registration } from '../lib/storage';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { Calendar, Users, Settings, Trash2, Search as SearchIcon, Building2, UserPlus, Mail, Lock, ShieldCheck, X, Copy, Check, Upload } from 'lucide-react';
import { Input } from '../components/ui/Input';
import { cn } from '../lib/utils';
import { useEscapeToClose } from '../hooks/useEscapeToClose';
import type { AppProfile } from '../lib/storage';
import { httpsCallable } from 'firebase/functions';
import { getFunctionsInstance } from '../lib/firebase';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseConfig } from '../lib/firebase';
import toast from 'react-hot-toast';


// Gera senha temporária forte usando CSPRNG (não Math.random, que é previsível).
const generateSecurePassword = (length = 14): string => {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += charset[values[i] % charset.length];
  }
  return pass;
};

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [profiles, setProfiles] = useState<AppProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'events' | 'partners'>('events');
  const [query, setQuery] = useState('');

  // Partner Form State
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [newPartner, setNewPartner] = useState({
    name: '',
    type: 'estabelecimento' as 'estabelecimento' | 'atletica',
    description: '',
    imageUrl: ''
  });
  const [lastGenerated, setLastGenerated] = useState<{ email: string; pass: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingPartner, setEditingPartner] = useState<AppProfile | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handlePartnerImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error("A imagem é muito grande (máx 5MB).");
        return;
      }
      setIsUploading(true);
      try {
        const url = await storage.uploadFile(file, 'profiles');
        setNewPartner(prev => ({ ...prev, imageUrl: url }));
      } catch (err) {
        console.error(err);
        toast.error("Erro ao fazer upload da imagem.");
      } finally {
        setIsUploading(false);
      }
    }
  };
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'warning';
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'warning'
  });

  // Fechar modais com Escape (acessibilidade de diálogo)
  useEscapeToClose(!!editingPartner, () => setEditingPartner(null));
  useEscapeToClose(showPartnerModal, () => setShowPartnerModal(false));
  useEscapeToClose(confirmModal.show, () => setConfirmModal(prev => ({ ...prev, show: false })));

  // Basic auth check for MVP
  const currentUser = storage.getCurrentUser();
  const userId = currentUser?.id;
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPartner, setIsSavingPartner] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId || currentUser?.role !== 'admin') {
      navigate('/feed');
      return;
    }

    try {
      const [allEvents, allRegs, allProfiles] = await Promise.all([
        storage.getEvents(),
        storage.getRegistrations(),
        storage.getProfiles()
      ]);

      setEvents(allEvents);
      setRegistrations(allRegs);
      setProfiles(allProfiles);
    } catch (error) {
      console.error("Erro ao carregar dados do admin:", error);
    } finally {
      setIsLoading(false);
    }
  }, [userId, navigate, currentUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  const handleGenerateMockEvents = async () => {
    const toastId = toast.loading('Gerando 10 eventos de Cáceres...');
    const creatorId = currentUser?.profileId || currentUser?.id || 'admin'; // usuário logado
    
    const eventsToCreate = [
      {
        title: "SUNSET PANTANEIRO",
        date: "2026-07-18",
        time: "17:00",
        location: "Iate Clube de Cáceres",
        address: "Av. Beira Rio, 1200 - Centro, Cáceres - MT, 78200-000",
        publicType: "Aberto" as const,
        description: "Venha curtir o melhor pôr do sol do Pantanal ao som de DJs regionais e muito pop/rock. Ambiente paradisíaco e drinks exclusivos na beira do rio.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappNumber: "5500000000000",
        whatsappName: "Contato",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "VIOLADA UNIVERSITÁRIA",
        date: "2026-07-24",
        time: "22:00",
        location: "Espaço Villa Maria",
        address: "R. dos Colhereiros, 450 - Jardim Paraíso, Cáceres - MT, 78200-000",
        publicType: "Universitário" as const,
        description: "A maior violada universitária da região! Muito sertanejo universitário, modão de viola e as atléticas mais animadas da cidade integradas na melhor PoC do semestre.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappNumber: "5500000000000",
        whatsappName: "Contato",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "CÁCERES ROCK FEST",
        date: "2026-08-01",
        time: "19:00",
        location: "Praia do Daveron",
        address: "Av. Beira Rio, s/n - Daveron, Cáceres - MT, 78200-000",
        publicType: "Aberto" as const,
        description: "Festival de Rock na beira do rio Paraguai. Bandas locais e nacionais tocando clássicos do rock nacional e internacional. Praça de alimentação e exposição de motos.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappNumber: "5500000000000",
        whatsappName: "Contato",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1469488865564-c2de10f69f96?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "BAILE DA VULCÂNICA",
        date: "2026-08-07",
        time: "21:00",
        location: "Quadra da FAPAN",
        address: "Av. São João, s/n - Cavalhada, Cáceres - MT, 78200-000",
        publicType: "Universitário" as const,
        description: "Festa oficial da Liga Vulkanica da UNEMAT! Muita música eletrônica, funk e pop para agitar a noite acadêmica. Integração total entre os cursos.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappNumber: "5500000000000",
        whatsappName: "Contato",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1574391884720-bbc3740c59d1?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "PAGODE DO BARÃO",
        date: "2026-07-19",
        time: "15:00",
        location: "Praça Barão do Rio Branco",
        address: "Praça Barão do Rio Branco, s/n - Centro, Cáceres - MT, 78200-000",
        publicType: "Geral" as const,
        description: "Aquele pagodinho de domingo à tarde no coração da cidade! Roda de samba, cerveja gelada e o melhor clima pantaneiro para fechar o fim de semana com chave de ouro.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappNumber: "5500000000000",
        whatsappName: "Contato",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1481162854517-d9e353af153d?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "EXPOCÁCERES WARM UP",
        date: "2026-08-14",
        time: "20:00",
        location: "Parque de Exposição Dr. Lázaro de Carvalho",
        address: "Rodovia BR-070, s/n - Zona Rural, Cáceres - MT, 78200-000",
        publicType: "Geral" as const,
        description: "O esquenta oficial para a maior feira agropecuária da região. Shows de sertanejo, leilões and praça de alimentação no melhor estilo country.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappNumber: "5500000000000",
        whatsappName: "Contato",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1549417229-aa67d3263c09?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "HALLOWEEN ANTECIPADO",
        date: "2026-08-28",
        time: "23:00",
        location: "Clube Monte Verde",
        address: "Av. dos Estados, 300 - Jardim Monte Verde, Cáceres - MT, 78200-000",
        publicType: "Aberto" as const,
        description: "Festa a fantasia mais esperada do ano! Decoração temática assustadora, concursos de fantasias com prêmios e a pista comandada pelos melhores DJs de open format.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappNumber: "5500000000000",
        whatsappName: "Contato",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1509248961158-e54f6934749c?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1537633552985-df8429e8048b?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "STAND-UP COMEDY CÁCERES",
        date: "2026-07-30",
        time: "20:00",
        location: "Espaço Conecta",
        address: "R. Coronel José Dulce, 150 - Centro, Cáceres - MT, 78200-000",
        publicType: "Geral" as const,
        description: "Uma noite de gargalhadas garantidas com os melhores comediantes do estado de Mato Grosso. Show de stand-up inédito na cidade com opções de chopp e petiscos.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappNumber: "5500000000000",
        whatsappName: "Contato",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1585699324551-f6c309eed262?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1527224857830-43a7acc85260?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "LUAU DA UNEMAT",
        date: "2026-08-08",
        time: "18:30",
        location: "Orla Beira Rio da UNEMAT",
        address: "Av. Santos Dumont, s/n - Santos Dumont, Cáceres - MT, 78200-000",
        publicType: "Universitário" as const,
        description: "Luau acústico sob a luz da lua na orla da UNEMAT. Roda de violão, fogueira controlada, comidinhas e bebidas para celebrar a volta às aulas com a galera acadêmica.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappNumber: "5500000000000",
        whatsappName: "Contato",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=800"
        ]
      },
      {
        title: "SERTANEJO PREMIUM",
        date: "2026-08-22",
        time: "22:00",
        location: "Centro de Eventos Sicredi",
        address: "Av. Getúlio Vargas, 1800 - Cavalhada, Cáceres - MT, 78200-000",
        publicType: "Geral" as const,
        description: "O melhor da música sertaneja em um ambiente climatizado e sofisticado. Duplas consagradas no cenário mato-grossense tocando sucessos do modão ao sertanejo pop.",
        creatorId,
        hasTickets: true,
        hasPixTickets: true,
        ticketPrice: "30",
        pixTicketPrice: "30",
        whatsappNumber: "5500000000000",
        whatsappName: "Contato",
        whatsappContacts: [
          { name: "Contato 1", phone: "(00) 00000-0000" },
          { name: "Contato 2", phone: "(00) 00000-0000" }
        ],
        isTestEvent: false,
        hasPresence: true,
        mediaUrls: [
          "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&q=80&w=800",
          "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&q=80&w=800"
        ]
      }
    ];

    try {
      for (const ev of eventsToCreate) {
        const tktId = `tkt-${crypto.randomUUID()}`;
        const eventItem = {
          ...ev,
          id: '',
          tickets: [
            {
              id: tktId,
              name: "Lote Único - Pix",
              price: 30,
              capacity: 150,
              sold: 0,
              status: "active" as const
            }
          ]
        };
        await storage.saveEvent(eventItem);
      }
      toast.success('10 Eventos Cáceres gerados com sucesso!', { id: toastId });
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar eventos Cáceres.', { id: toastId });
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Excluir evento?',
      message: 'Esta ação removerá o evento permanentemente e cancelará todas as inscrições.',
      type: 'danger',
      onConfirm: async () => {
        await storage.deleteEvent(id);
        const updatedEvents = await storage.getEvents();
        setEvents(updatedEvents);
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleDeleteProfile = async (id: string) => {
    setConfirmModal({
      show: true,
      title: 'Excluir parceiro?',
      message: 'Todos os acessos e dados deste parceiro serão removidos do sistema.',
      type: 'danger',
      onConfirm: async () => {
        await storage.deleteProfile(id);
        setProfiles(prev => prev.filter(p => p.id !== id));
        setConfirmModal(prev => ({ ...prev, show: false }));
      }
    });
  };

  const handleAddPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    // Remove acentos e espaços do nome para gerar e-mail válido no Firebase Auth
    const email = `${newPartner.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '')}@chain.app`;
    const password = generateSecurePassword();

    setIsSavingPartner(true);
    try {
      const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp" + Date.now());
      const secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = userCredential.user.uid;

      await signOut(secondaryAuth); // Finaliza a sessão temporária

      // 2. Salvar o perfil no Firestore usando o UID real
      const profile: AppProfile = {
        id: uid,
        ...newPartner,
        email,
        mustChangePassword: true
      };

      await storage.saveProfile(profile);
      const allProfiles = await storage.getProfiles();
      setProfiles(allProfiles);
      setLastGenerated({ email, pass: password }); // A senha fica só na tela, nunca no banco

      setNewPartner({ name: '', type: 'estabelecimento', description: '', imageUrl: '' });
    } catch (error: any) {
      console.error("Erro ao adicionar parceiro:", error);
      if (error?.code === 'auth/email-already-in-use') {
        toast.error("Este parceiro já existe! Tente adicionar um número ou sobrenome ao nome.");
      } else {
        toast.error("Erro ao criar parceiro. Verifique o console.");
      }
    } finally {
      setIsSavingPartner(false);
    }
  };

  const handleEditPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartner) return;
    setIsSavingPartner(true);
    try {
      const updates: Partial<AppProfile> = {
        name: editingPartner.name,
        type: editingPartner.type,
        description: editingPartner.description || '',
        mustChangePassword: editingPartner.mustChangePassword || false
      };

      // Se uma nova senha foi digitada, redefinir usando a Cloud Function segura
      if (editingPartner.password && editingPartner.password.trim() !== '') {
        const functions = getFunctionsInstance();
        const adminResetPassword = httpsCallable(functions, 'adminResetPassword');
        await adminResetPassword({
          uid: editingPartner.id,
          newPassword: editingPartner.password
        });

        // Forçar alteração de senha no próximo login
        updates.mustChangePassword = true;
      }

      await storage.updateProfile(editingPartner.id, updates);
      const allProfiles = await storage.getProfiles();
      setProfiles(allProfiles);
      setEditingPartner(null);
      toast.success('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error("Erro ao atualizar parceiro:", error);
      toast.error("Erro ao atualizar parceiro ou ao redefinir a senha.");
    } finally {
      setIsSavingPartner(false);
    }
  };

  const filteredEvents = events.filter(e => e.title.toLowerCase().includes(query.toLowerCase()));
  const filteredProfiles = profiles.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));

  const totalRegistrations = registrations.length;

  return (
    <>
      <div ref={containerRef} className="min-h-screen bg-background pb-28 pt-8 px-4 relative">
        {/* Header */}
        <div className="flex items-center gap-3.5 mb-6 admin-anim relative z-10 text-left">
          <div className="w-12 h-12 rounded-2xl bg-accent/15 text-accent flex items-center justify-center border border-accent/20">
            <Settings size={22} />
          </div>
          <div>
            <h1 className="font-display font-semibold text-2xl text-textLight leading-tight">Painel de controle</h1>
            <p className="text-xs font-medium text-textMuted mt-0.5">Gerencie seus eventos e parceiros</p>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-2 gap-3.5 mb-6 admin-anim relative z-10 text-left">
          <div className="surface p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-primary mb-2">
              <Calendar size={15} />
              <span className="text-xs font-medium text-textMuted">Total de eventos</span>
            </div>
            <span className="font-display text-3xl font-semibold text-textLight leading-none">{events.length}</span>
          </div>
          <div className="surface p-4 rounded-2xl shadow-sm">
            <div className="flex items-center gap-2 text-accent mb-2">
              <Users size={15} />
              <span className="text-xs font-medium text-textMuted">Inscrições</span>
            </div>
            <span className="font-display text-3xl font-semibold text-textLight leading-none">{totalRegistrations}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-3 mb-6 admin-anim relative z-10">
          <button
            onClick={() => setActiveTab('events')}
            className={cn(
              "flex-1 py-3.5 rounded-xl font-sans font-semibold text-sm transition-colors duration-200 flex items-center justify-center gap-2 border cursor-pointer",
              activeTab === 'events'
                ? "bg-primary/10 text-primary border-primary/30"
                : "surface text-textMuted hover:text-textLight"
            )}
          >
            <Calendar size={16} />
            Eventos
          </button>
          <button
            onClick={() => setActiveTab('partners')}
            className={cn(
              "flex-1 py-3.5 rounded-xl font-sans font-semibold text-sm transition-colors duration-200 flex items-center justify-center gap-2 border cursor-pointer",
              activeTab === 'partners'
                ? "bg-accent/10 text-accent border-accent/30"
                : "surface text-textMuted hover:text-textLight"
            )}
          >
            <Building2 size={16} />
            Parceiros
          </button>
        </div>

        <div className="relative mb-4 admin-anim z-10">
          <Input
            placeholder={activeTab === 'events' ? "Buscar eventos..." : "Buscar parceiros..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-12 md:pl-12"
          />
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={18} />
        </div>

        {activeTab === 'events' ? (
          <>
            <div className="flex justify-between items-center mb-4 admin-anim relative z-10 flex-wrap gap-2">
              <h2 className="font-display text-lg font-semibold text-textLight">Gerenciar eventos</h2>
              <div className="flex gap-2">
                <Button onClick={handleGenerateMockEvents} type="button" variant="outline" size="sm" className="rounded-xl">
                  ⚡ Gerar Eventos Cáceres
                </Button>
                <Button onClick={() => navigate('/create')} variant="primary" size="sm" className="rounded-xl">
                  + Novo evento
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={`ev-sk-${i}`} className="h-32 rounded-2xl" />
              ))}
              {filteredEvents.map(event => {
                const eventRegs = registrations.filter(r => r.eventId === event.id).length;

                return (
                  <div key={event.id} className="surface surface-hover p-5 rounded-2xl flex flex-col gap-3.5 admin-anim shadow-sm text-left">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display font-semibold text-base text-textLight truncate">{event.title}</h3>
                        <p className="text-xs text-textMuted mt-1.5">{formatDateBR(event.date)}</p>
                      </div>
                      <div className="bg-primary/10 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shrink-0 border border-primary/20">
                        <Users size={12} className="text-primary" />
                        <span className="font-mono text-xs font-bold text-primary">{eventRegs}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-3 border-t border-glassBorder">
                      <button
                        onClick={() => navigate(`/event/${event.id}`)}
                        className="flex-1 py-2 rounded-xl text-sm font-sans font-semibold text-textLight surface hover:text-accent transition-colors duration-200 cursor-pointer"
                      >
                        Ver página
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="px-4 py-2 text-textMuted hover:text-danger border border-glassBorder hover:border-danger/40 rounded-xl bg-surface/50 hover:bg-danger/10 transition-colors duration-200 cursor-pointer"
                        title="Excluir evento"
                        aria-label="Excluir evento"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {!isLoading && filteredEvents.length === 0 && (
                <div className="text-center py-10 admin-anim">
                  <p className="text-textMuted text-sm">Nenhum evento encontrado.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4 admin-anim relative z-10">
              <h2 className="font-display text-lg font-semibold text-textLight">Gerenciar parceiros</h2>
              <Button onClick={() => { setLastGenerated(null); setShowPartnerModal(true); }} variant="primary" size="sm" className="rounded-xl">
                + Novo parceiro
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
              {isLoading && Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={`pt-sk-${i}`} className="h-24 rounded-2xl" />
              ))}
              {filteredProfiles.map(profile => (
                <div key={profile.id} className="surface surface-hover p-4 rounded-2xl flex items-center gap-4 admin-anim shadow-sm text-left">
                  <div className="w-12 h-12 rounded-xl bg-surface/50 flex items-center justify-center text-accent overflow-hidden shrink-0 border border-glassBorder shadow-sm">
                    {profile.imageUrl ? <img src={profile.imageUrl} alt={`Foto de ${profile.name}`} className="w-full h-full object-cover" /> : <Building2 size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-base font-semibold text-textLight truncate leading-tight">{profile.name}</h3>
                    <p className="text-xs text-accent font-medium mt-1">{profile.type}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-primary font-mono bg-primary/10 px-2.5 py-0.5 rounded-lg border border-primary/20">
                      <Mail size={10} />
                      {profile.email || 'N/A'}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditingPartner(profile)}
                        className="p-1.5 text-textLight hover:text-accent transition-colors duration-200 bg-surface/50 hover:bg-surfaceHover rounded-xl border border-glassBorder hover:border-accent/40 cursor-pointer"
                        title="Editar parceiro"
                      >
                        <Settings size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteProfile(profile.id)}
                        className="p-1.5 text-textLight hover:text-danger transition-colors duration-200 bg-surface/50 hover:bg-surfaceHover rounded-xl border border-glassBorder hover:border-danger/40 cursor-pointer"
                        title="Excluir parceiro"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {!isLoading && filteredProfiles.length === 0 && (
                <div className="text-center py-10 admin-anim">
                  <p className="text-textMuted text-sm">Nenhum parceiro encontrado.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal Editar Parceiro */}
        {editingPartner && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-edit-partner-title"
          >
            <div className="glass rounded-3xl p-6 md:p-8 max-w-md w-full relative max-h-[90vh] overflow-y-auto border border-glassBorder backdrop-blur-3xl text-left shadow-md">
              <button aria-label="Fechar modal" title="Fechar modal" onClick={() => setEditingPartner(null)} className="absolute top-6 right-6 p-2 border border-glassBorder rounded-xl bg-surface/50 hover:bg-surfaceHover hover:border-accent/40 text-textLight cursor-pointer transition-colors duration-200">
                <X size={16} />
              </button>

              <form onSubmit={handleEditPartner} className="space-y-4 mt-2">
                <div className="text-center mb-6 mt-4">
                  <div className="w-14 h-14 bg-primary/20 border border-primary/20 rounded-2xl flex items-center justify-center text-primary mx-auto mb-3">
                    <Settings size={24} />
                  </div>
                  <h3 id="admin-edit-partner-title" className="font-display text-2xl font-semibold text-textLight leading-tight">Editar parceiro</h3>
                  <p className="text-xs font-medium text-textMuted mt-1">Modifique as informações e acessos</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-textMuted ml-1">Nome do parceiro</label>
                  <Input
                    required
                    value={editingPartner.name}
                    onChange={e => setEditingPartner(prev => prev ? ({ ...prev, name: e.target.value }) : null)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="edit-partner-type" className="text-xs font-medium text-textMuted ml-1">Tipo</label>
                  <select
                    id="edit-partner-type"
                    title="Tipo de parceiro"
                    className="w-full h-12 bg-surfaceHover/50 border border-glassBorder rounded-xl px-4 text-sm text-textLight focus:outline-none focus:border-primary/40 transition-colors duration-200 cursor-pointer"
                    value={editingPartner.type}
                    onChange={e => setEditingPartner(prev => prev ? ({ ...prev, type: e.target.value as any }) : null)}
                  >
                    <option value="user">Usuário comum</option>
                    <option value="estabelecimento">Estabelecimento</option>
                    <option value="atletica">Atlética</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-textMuted ml-1">Nova senha (opcional)</label>
                  <Input
                    placeholder="Digite para alterar"
                    value={editingPartner.password || ''}
                    onChange={e => setEditingPartner(prev => prev ? ({ ...prev, password: e.target.value }) : null)}
                  />
                </div>

                <div className="flex items-center gap-3.5 mt-4 px-1">
                  <input
                    type="checkbox"
                    id="mustChangePassword"
                    checked={editingPartner.mustChangePassword}
                    onChange={e => setEditingPartner(prev => prev ? ({ ...prev, mustChangePassword: e.target.checked }) : null)}
                    className="accent-primary w-5 h-5 cursor-pointer border border-glassBorder rounded-md"
                  />
                  <label htmlFor="mustChangePassword" className="text-xs text-textMuted cursor-pointer font-medium">
                    Obrigar alteração de senha no login
                  </label>
                </div>

                <Button type="submit" loading={isSavingPartner} className="w-full rounded-xl py-4 mt-6">
                  {isSavingPartner ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Modal Novo Parceiro */}
        {showPartnerModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-new-partner-title"
          >
            <div className="glass rounded-3xl p-6 md:p-8 max-w-md w-full relative border border-glassBorder backdrop-blur-3xl text-left shadow-md">
              <button aria-label="Fechar modal" title="Fechar modal" onClick={() => setShowPartnerModal(false)} className="absolute top-6 right-6 p-2 border border-glassBorder rounded-xl bg-surface/50 hover:bg-surfaceHover hover:border-accent/40 text-textLight cursor-pointer transition-colors duration-200">
                <X size={16} />
              </button>

              {!lastGenerated ? (
                <form onSubmit={handleAddPartner} className="space-y-4">
                  <div className="text-center mb-6 mt-4">
                    <div className="w-14 h-14 bg-primary/20 border border-primary/20 rounded-2xl flex items-center justify-center text-primary mx-auto mb-3">
                      <UserPlus size={24} />
                    </div>
                    <h3 id="admin-new-partner-title" className="font-display text-2xl font-semibold text-textLight leading-tight">Cadastrar parceiro</h3>
                    <p className="text-xs font-medium text-textMuted mt-1">Crie acesso para novos parceiros</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-textMuted ml-1">Nome do parceiro</label>
                    <Input
                      required
                      placeholder="Ex: Velvet Club"
                      value={newPartner.name}
                      onChange={e => setNewPartner(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="partner-type" className="text-xs font-medium text-textMuted ml-1">Tipo</label>
                    <select
                      id="partner-type"
                      className="w-full h-12 bg-surfaceHover/50 border border-glassBorder rounded-xl px-4 text-sm text-textLight focus:outline-none focus:border-primary/40 transition-colors duration-200 cursor-pointer"
                      value={newPartner.type}
                      onChange={e => setNewPartner(prev => ({ ...prev, type: e.target.value as any }))}
                    >
                      <option value="user">Usuário comum</option>
                      <option value="estabelecimento">Estabelecimento</option>
                      <option value="atletica">Atlética</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-textMuted ml-1">Descrição curta</label>
                    <Input
                      required
                      placeholder="Ex: O melhor lounge da cidade"
                      value={newPartner.description}
                      onChange={e => setNewPartner(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-medium text-textMuted ml-1 block">Foto do parceiro (opcional)</label>
                    <div className="flex items-center gap-3.5 bg-surface/30 p-3 rounded-xl border border-glassBorder">
                      {newPartner.imageUrl ? (
                        <div className="relative w-14 h-14 rounded-lg border border-glassBorder overflow-hidden shrink-0 group">
                          <img src={newPartner.imageUrl} className="w-full h-full object-cover" alt="Preview" />
                          <button
                            type="button"
                            onClick={() => setNewPartner(prev => ({ ...prev, imageUrl: '' }))}
                            className="absolute inset-0 bg-danger/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-textDark transition-opacity duration-200 text-[11px] font-semibold cursor-pointer"
                          >
                            Remover
                          </button>
                        </div>
                      ) : (
                        <label className="w-14 h-14 rounded-lg border border-dashed border-primary/45 flex flex-col items-center justify-center text-textMuted cursor-pointer hover:border-accent hover:text-accent transition-colors duration-200 bg-surface/50 hover:bg-surfaceHover">
                          {isUploading ? (
                            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Upload size={16} className="text-primary" />
                              <span className="text-[11px] font-medium mt-1">Upload</span>
                            </>
                          )}
                          <input type="file" className="hidden" accept="image/*" disabled={isUploading} onChange={handlePartnerImageUpload} />
                        </label>
                      )}
                      <div className="text-[11px] text-textMuted leading-relaxed">
                        {newPartner.imageUrl ? "Foto pronta para salvar!" : "Selecione uma imagem JPG/PNG de até 5MB."}
                      </div>
                    </div>
                  </div>

                  <Button type="submit" loading={isSavingPartner} className="w-full rounded-xl py-4 mt-6">
                    {isSavingPartner ? 'Salvando...' : 'Gerar acesso e salvar'}
                  </Button>
                </form>
              ) : (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-success/10 text-success rounded-2xl border border-success/20 flex items-center justify-center mx-auto mb-5">
                    <ShieldCheck size={32} />
                  </div>
                  <h3 id="admin-new-partner-title" className="font-display text-2xl font-semibold text-textLight leading-tight mb-2">Parceiro criado!</h3>
                  <p className="text-sm text-textMuted mb-6">Salve os dados de acesso abaixo:</p>

                  <div className="surface p-5 rounded-2xl mb-8 relative shadow-sm space-y-4 text-left">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`Email: ${lastGenerated.email}\nSenha: ${lastGenerated.pass}`);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="absolute top-4 right-4 p-2 bg-surface/50 hover:bg-surfaceHover text-primary border border-glassBorder hover:border-primary/40 rounded-xl cursor-pointer transition-colors duration-200"
                      title="Copiar dados"
                    >
                      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                    </button>

                    <div>
                      <p className="text-xs font-medium text-textMuted mb-1">E-mail de acesso</p>
                      <p className="font-mono text-sm font-bold text-textLight flex items-center gap-2">
                        <Mail size={14} className="text-primary" />
                        {lastGenerated.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-textMuted mb-1">Senha temporária</p>
                      <p className="font-mono text-sm font-bold text-textLight flex items-center gap-2">
                        <Lock size={14} className="text-accent" />
                        {lastGenerated.pass}
                      </p>
                    </div>
                  </div>

                  <Button onClick={() => setShowPartnerModal(false)} className="w-full rounded-xl py-3.5">
                    Concluído
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Custom Confirm Modal */}
      {confirmModal.show && (
        <div
          className="fixed inset-0 z-[100] modal-backdrop flex items-center justify-center p-6"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="admin-confirm-title"
          aria-describedby="admin-confirm-desc"
          onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
        >
          <div
            className="glass rounded-3xl p-6 md:p-8 max-w-sm w-full border border-glassBorder backdrop-blur-3xl text-center shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-16 h-16 rounded-2xl border flex items-center justify-center mb-6",
                confirmModal.type === 'danger' ? "bg-danger/10 border-danger/20 text-danger" : "bg-primary/10 border-primary/20 text-primary"
              )}>
                <Trash2 size={26} />
              </div>
              <h3 id="admin-confirm-title" className="font-display text-xl font-semibold text-textLight mb-3">{confirmModal.title}</h3>
              <p id="admin-confirm-desc" className="text-sm text-textMuted mb-8 font-sans leading-relaxed">
                {confirmModal.message}
              </p>
              <div className="flex gap-3.5 w-full">
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 py-3.5 rounded-xl border border-glassBorder bg-surface/50 text-textLight font-sans font-semibold text-sm hover:bg-surfaceHover hover:border-accent/40 hover:text-accent transition-colors duration-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className={cn(
                    "flex-1 py-3.5 rounded-xl border font-sans font-semibold text-sm transition-colors duration-200 cursor-pointer shadow-sm text-textDark",
                    confirmModal.type === 'danger'
                      ? "bg-danger border-danger/20 hover:brightness-95"
                      : "bg-primary border-primary/20 hover:bg-primaryHover"
                  )}
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
