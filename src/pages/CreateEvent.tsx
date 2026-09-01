import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { storage, EVENT_CATEGORIES } from '../lib/storage';
import type { AppProfile, EventItem, EventCategory } from '../lib/storage';
import { cn, goBack } from '../lib/utils';
import {
  ArrowLeft, Image as ImageIcon, MapPin, X, Plus, Clock, Loader2,
  CalendarPlus, Upload, Trash2, AlertTriangle, FileText, Sparkles
} from 'lucide-react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { useAuth } from '../contexts/AuthContext';
import { useForm } from 'react-hook-form';
import type { FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import toast from 'react-hot-toast';
import type { Area } from 'react-easy-crop';
import { getCroppedImg } from '../lib/imageUtils';
import { formatDateBR } from '../lib/formatters';
import { DateTimePickerModal } from '../components/CreateEvent/DateTimePickerModal';
import { LocationPickerModal } from '../components/CreateEvent/LocationPickerModal';
import { ImageCropModal } from '../components/CreateEvent/ImageCropModal';

const eventSchema = z.object({
  title: z.string().min(3, "Mínimo 3 caracteres"),
  date: z.string().min(1, "Data obrigatória"),
  time: z.string().min(1, "Horário obrigatório"),
  location: z.string().min(1, "Local obrigatório"),
  address: z.string().min(1, "Endereço obrigatório"),
  publicType: z.string().optional(),
  category: z.string().optional(),
  description: z.string().min(10, "A descrição deve ter no mínimo 10 caracteres"),
  hasTickets: z.boolean(),
  ticketPrice: z.string().optional(),
  isTestEvent: z.boolean().optional(),
  hasPresence: z.boolean().optional(),
  // Teto total de participantes; string no form, convertido no submit. Vazio = sem limite.
  maxParticipants: z.string().optional().refine(
    v => !v || (/^\d+$/.test(v) && Number(v) > 0),
    'O limite de participantes deve ser um número maior que zero'
  ),
  whatsappContacts: z.array(z.object({ name: z.string(), phone: z.string() })).optional(),
  mediaUrls: z.array(z.string())
}).refine(data => {
  if (!data.hasTickets) return true;
  if (data.whatsappContacts && data.whatsappContacts.length > 0) {
    const firstPhone = data.whatsappContacts[0].phone.replace(/\D/g, '');
    return firstPhone.length >= 10;
  }
  return false;
}, {
  message: "WhatsApp obrigatório para vendas (mín. 10 digitos)",
  path: ["whatsappContacts"]
});

type EventFormValues = z.infer<typeof eventSchema>;

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export const CreateEvent = () => {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
      <CreateEventContent />
    </APIProvider>
  );
};

const CreateEventContent = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const { register, handleSubmit: formSubmit, watch, setValue, formState: { isSubmitting }, reset } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      date: '',
      time: '',
      publicType: 'Aberto',
      category: 'Festa',
      description: '',
      location: 'Centro',
      address: '',
      mediaUrls: [],
      hasTickets: false,
      ticketPrice: '',
      isTestEvent: false,
      hasPresence: false,
      maxParticipants: '',
      whatsappContacts: [{ name: '', phone: '' }]
    }
  });

  const mediaUrls = watch('mediaUrls');
  const hasTickets = watch('hasTickets');
  const isTestEvent = watch('isTestEvent');
  const address = watch('address');
  const hasPresence = watch('hasPresence');
  const dateValue = watch('date');
  const timeValue = watch('time');
  const selectedCategory = watch('category') || 'Festa';

  const [isUploading, setIsUploading] = useState(false);

  // Diálogos: cada um é um componente em components/CreateEvent/.
  const [showMapModal, setShowMapModal] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  // A imagem em recorte é o próprio estado de abertura do diálogo de crop.
  const [imageSrc, setImageSrc] = useState('');
  const [currentFile, setCurrentFile] = useState<File | null>(null);

  const { user } = useAuth();
  const userId = user?.id;
  const userRole = user?.role;
  const [originalCreatorId, setOriginalCreatorId] = useState<string | null>(null);

  // Admin pode criar o evento em nome de um parceiro.
  const [profiles, setProfiles] = useState<AppProfile[]>([]);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>('');

  useEffect(() => {
    const loadEventData = async () => {
      if (userRole === 'admin') {
        try {
          const allProfiles = await storage.getProfiles();
          // Perfis profissionais; docs legados ('atletica'/'estabelecimento') contam como profissional.
          setProfiles(allProfiles.filter(p => p.type !== 'user' && p.type !== 'admin'));
        } catch (error) {
          console.error("Erro ao carregar perfis:", error);
        }
      }

      if (id) {
        try {
          const events = await storage.getEvents();
          const ev = events.find(e => e.id === id);
          if (ev) {
            reset({
              title: ev.title,
              date: ev.date,
              time: ev.time,
              publicType: ev.publicType,
              category: ev.category || 'Festa',
              description: ev.description,
              location: ev.location,
              address: ev.address || '',
              mediaUrls: ev.mediaUrls || [],
              hasTickets: !!ev.hasTickets,
              ticketPrice: ev.ticketPrice || '',
              isTestEvent: !!ev.isTestEvent,
              // Eventos antigos sem hasPresence (undefined) tratam como habilitado —
              // difere de propósito do default de evento NOVO (desligado, defaultValues acima).
              hasPresence: ev.hasPresence ?? true,
              maxParticipants: ev.maxParticipants != null ? String(ev.maxParticipants) : '',
              whatsappContacts: ev.whatsappContacts?.length ? ev.whatsappContacts : [{ name: '', phone: '' }]
            });
            setOriginalCreatorId(ev.creatorId);
            setSelectedCreatorId(ev.creatorId);
          }
        } catch (error) {
          console.error("Erro ao carregar dados do evento para edição:", error);
        }
      }
    };
    loadEventData();
  }, [id, userRole, reset]);

  // Basta estar logado: qualquer usuário pode criar seus próprios eventos.
  useEffect(() => {
    if (!userId) {
      navigate('/feed');
    }
  }, [userId, navigate]);

  const onSubmit = async (data: EventFormValues) => {
    const targetCreatorId = selectedCreatorId || user?.profileId || userId!;
    // Teto total: string do form vira número; vazio vira null (sem limite; Firestore não aceita undefined).
    const { maxParticipants: maxPartStr, ...restData } = data;
    const eventData: EventItem = {
      ...restData,
      maxParticipants: maxPartStr && Number(maxPartStr) > 0 ? Number(maxPartStr) : null,
      id: id || Date.now().toString(),
      publicType: (data.publicType || 'Aberto') as EventItem['publicType'],
      category: (data.category || 'Festa') as EventCategory,
      whatsappContacts: data.whatsappContacts?.filter(c => c.phone.trim() !== '') || [],
      creatorId: id ? (selectedCreatorId || originalCreatorId || targetCreatorId) : targetCreatorId,
    };
    try {
      await storage.saveEvent(eventData);
      toast.success('Evento salvo com sucesso!');
      navigate('/profile');
    } catch (err) {
      console.error(err);
      const code = (err as { code?: string })?.code;
      toast.error(code === 'permission-denied'
        ? 'Sem permissão para salvar o evento nesta conta.'
        : `Erro ao salvar o evento${code ? ` (${code})` : '.'}`);
    }
  };

  const onError = (errors: FieldErrors<EventFormValues>) => {
    Object.values(errors).forEach(err => {
      if (err && 'message' in err && typeof err.message === 'string') toast.error(err.message);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.type.startsWith('video/')) {
      toast.error("Apenas imagens são suportadas.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error(`A imagem é muito grande (máx 15MB).`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCurrentFile(file);
    };
    reader.readAsDataURL(file);
  };

  const fecharCrop = () => {
    setImageSrc('');
    setCurrentFile(null);
  };

  const handleCropConfirm = async (area: Area) => {
    if (!imageSrc || !currentFile) return;
    setIsUploading(true);
    const toastId = toast.loading('Processando imagem e fazendo upload...');

    try {
      const croppedFile = await getCroppedImg(imageSrc, area, currentFile.name);
      const url = await storage.uploadFile(croppedFile, 'events');
      setValue('mediaUrls', [...mediaUrls, url], { shouldValidate: true });
      toast.success('Upload concluído!');
    } catch (error) {
      console.error("Erro no recorte/upload:", error);
      toast.error('Falha ao processar imagem.');
    } finally {
      setIsUploading(false);
      fecharCrop();
      toast.dismiss(toastId);
    }
  };

  const removeMedia = (index: number) => {
    setValue('mediaUrls', mediaUrls.filter((_: string, i: number) => i !== index), { shouldValidate: true });
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-background pb-28 pt-4 md:pt-6 px-3 md:px-4 relative">
      <button
        type="button"
        onClick={() => goBack(navigate)}
        title="Voltar"
        aria-label="Voltar"
        className="w-9 h-9 md:w-10 md:h-10 mb-4 md:mb-6 rounded-xl bg-surface border border-glassBorder text-textLight flex items-center justify-center shadow-sm hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer relative z-10"
      >
        <ArrowLeft size={18} />
      </button>

      <div className="max-w-2xl mx-auto">
        <div className="create-anim flex items-center gap-2.5 md:gap-3.5 mb-4 md:mb-6 relative z-10 text-left">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-accent/15 text-accent flex items-center justify-center border border-accent/20">
            <CalendarPlus size={18} className="md:hidden" />
            <CalendarPlus size={22} className="hidden md:block" />
          </div>
          <div>
            <h1 className="font-display font-semibold text-lg md:text-2xl text-textLight leading-tight animate-fade-in">
              {isEdit ? 'Editar evento' : 'Criar evento'}
            </h1>
            <p className="text-xs text-textMuted mt-0.5">Configure os detalhes do seu evento</p>
          </div>
        </div>

        {user ? (
          <form onSubmit={formSubmit(onSubmit, onError)} className="space-y-3.5 md:space-y-5 relative z-10">
            {/* Admin Select Partner */}
            {userRole === 'admin' && (
              <div className="create-anim space-y-1 text-left">
                <label htmlFor="creator-select" className="text-xs font-medium text-textMuted ml-1 block">
                  Criar evento pelo perfil profissional:
                </label>
                <select
                  id="creator-select"
                  title="Selecione o perfil criador"
                  className="w-full h-10 md:h-12 bg-surface border border-glassBorder rounded-xl px-3 md:px-4 text-xs md:text-sm font-sans focus:outline-none focus:border-primary/40 transition-all text-textLight"
                  value={selectedCreatorId}
                  onChange={e => setSelectedCreatorId(e.target.value)}
                >
                  <option value="">(Nenhum - Criar como Admin)</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id} className="text-stone-900 bg-white">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Media Upload */}
            <div className="create-anim space-y-2 text-left">
              <label className="text-xs font-medium text-textMuted ml-1 flex items-center gap-1.5">
                <ImageIcon size={12} />
                Fotos do evento
              </label>
              <div className="grid grid-cols-3 gap-2 md:gap-3">
                {mediaUrls.map((url: string, i: number) => (
                  <div key={i} className="aspect-square rounded-2xl bg-surface border border-glassBorder shadow-sm relative overflow-hidden group">
                    <img src={url} alt={`Mídia ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeMedia(i)}
                      title="Remover mídia"
                      aria-label="Remover mídia"
                      className="absolute top-2 right-2 w-6 h-6 bg-danger text-textLight border border-danger/20 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer duration-300"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {mediaUrls.length < 6 && (
                  <label className="aspect-square rounded-2xl bg-surfaceHover/50 border border-dashed border-primary/45 flex flex-col items-center justify-center text-textMuted cursor-pointer hover:border-accent/60 hover:text-accent transition-all duration-300 hover:bg-surfaceHover">
                    {isUploading ? (
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Upload size={20} className="text-primary" />
                        <span className="text-[11px] font-medium mt-1">Enviar</span>
                      </>
                    )}
                    <input type="file" className="hidden" accept="image/*" disabled={isUploading} onChange={handleFileChange} />
                  </label>
                )}
              </div>
            </div>

            {/* Title */}
            <div className="create-anim space-y-1 text-left">
              <label className="text-xs font-medium text-textMuted ml-1 flex items-center gap-1.5">
                <FileText size={12} />
                Nome do evento
              </label>
              <Input
                placeholder="Ex: Sunset Party"
                className="bg-surface border-glassBorder text-textLight"
                {...register('title')}
              />
            </div>

            {/* Category */}
            <div className="create-anim space-y-1.5 text-left">
              <label className="text-xs font-medium text-textMuted ml-1 flex items-center gap-1.5">
                <Sparkles size={12} />
                Categoria
              </label>
              <div className="flex flex-wrap gap-1.5 md:gap-2">
                {EVENT_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setValue('category', cat)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border",
                        isSelected
                          ? "bg-primary text-black border-primary shadow-sm font-semibold"
                          : "bg-surface text-textMuted border-glassBorder hover:border-primary/40 hover:text-textLight"
                      )}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div className="create-anim space-y-1 text-left">
              <label className="text-xs font-medium text-textMuted ml-1">Descrição</label>
              <textarea
                placeholder="Descreva o evento..."
                className="w-full min-h-[90px] md:min-h-[120px] bg-surface border border-glassBorder rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-sans text-textLight focus:outline-none focus:border-primary/40 transition-all duration-300 resize-none placeholder:text-textMuted/50"
                {...register('description')}
              />
            </div>

            {/* Date & Time */}
            <div className="create-anim grid grid-cols-2 gap-2 md:gap-3 text-left">
              <div className="space-y-1">
                <label className="text-xs font-medium text-textMuted ml-1 flex items-center gap-1.5">
                  <CalendarPlus size={12} />
                  Data
                </label>
                <div
                  onClick={() => setShowDatePickerModal(true)}
                  className="cursor-pointer"
                >
                  <Input
                    readOnly
                    placeholder="Selecione a data"
                    className="bg-surface border-glassBorder text-textLight cursor-pointer pointer-events-none"
                    value={dateValue ? formatDateBR(dateValue) : ''}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-textMuted ml-1 flex items-center gap-1.5">
                  <Clock size={12} />
                  Horário
                </label>
                <div
                  onClick={() => setShowDatePickerModal(true)}
                  className="cursor-pointer"
                >
                  <Input
                    readOnly
                    placeholder="Selecione o horário"
                    className="bg-surface border-glassBorder text-textLight cursor-pointer pointer-events-none"
                    value={timeValue || ''}
                  />
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="create-anim grid grid-cols-[1fr_auto] gap-2 items-end text-left">
              <div className="space-y-1">
                <label className="text-xs font-medium text-textMuted ml-1 flex items-center gap-1.5">
                  <MapPin size={12} />
                  Local
                </label>
                <Input
                  placeholder="Ex: Pub Aurora"
                  className="bg-surface border-glassBorder text-textLight"
                  {...register('location')}
                />
              </div>
              <button
                type="button"
                onClick={() => setShowMapModal(true)}
                className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20 transition-all border border-primary/20 shadow-sm cursor-pointer"
                title="Escolher no Mapa"
              >
                <MapPin size={18} />
              </button>
            </div>

            {/* Address */}
            <div className="create-anim space-y-1 text-left">
              <label className="text-xs font-medium text-textMuted ml-1">Endereço completo</label>
              <Input
                placeholder="Ex: Rua X, 123 - Bairro - Cidade/UF"
                className="bg-surface border-glassBorder text-textLight"
                {...register('address')}
              />
            </div>



            {/* Presence Toggle */}
            <div className="create-anim space-y-2.5 md:space-y-3.5 surface rounded-2xl p-3.5 md:p-5 text-left">
              <div className="flex items-center justify-between">
                <label className="text-xs md:text-sm font-display font-semibold text-textLight">Habilitar confirmação de presença?</label>
                <button
                  type="button"
                  onClick={() => setValue('hasPresence', !hasPresence, { shouldValidate: true })}
                  title="Habilitar Confirmação de Presença"
                  aria-label="Habilitar Confirmação de Presença"
                  role="switch"
                  aria-checked={hasPresence}
                  className={cn(
                    "w-12 h-7 rounded-full transition-all relative border border-glassBorder cursor-pointer",
                    hasPresence ? 'bg-primary/20 border-primary/45' : 'bg-surfaceHover/50'
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full absolute top-[3px] transition-all",
                      hasPresence ? 'right-[3px] bg-primary' : 'left-[3px] bg-textMuted'
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Limite total de participantes (opcional) */}
            <div className="create-anim space-y-2 surface rounded-2xl p-3.5 md:p-5 text-left">
              <label htmlFor="max-participants" className="text-xs md:text-sm font-display font-semibold text-textLight block">
                Limite de participantes <span className="font-sans font-normal text-textMuted">(opcional)</span>
              </label>
              <input
                id="max-participants"
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="Sem limite"
                {...register('maxParticipants')}
                className="w-full h-11 bg-surfaceHover/50 border border-glassBorder rounded-xl px-4 text-sm font-sans text-textLight focus:outline-none focus:border-primary/40 focus:shadow-glow-primary placeholder:text-textMuted/50 transition-all duration-300"
              />
              <p className="text-[11px] text-textMuted leading-relaxed">
                Teto total do evento (presenças + ingressos). Ao atingir, novas confirmações são bloqueadas.
              </p>
            </div>

            {/* Tickets Toggle */}
            <div className="create-anim space-y-2.5 md:space-y-3.5 surface rounded-2xl p-3.5 md:p-5 text-left">
              <div className="flex items-center justify-between">
                <label className="text-xs md:text-sm font-display font-semibold text-textLight">Possui ingressos?</label>
                <button
                  type="button"
                  onClick={() => setValue('hasTickets', !hasTickets, { shouldValidate: true })}
                  title="Possui ingressos"
                  aria-label="Possui ingressos"
                  role="switch"
                  aria-checked={hasTickets}
                  className={cn(
                    "w-12 h-7 rounded-full transition-all relative border border-glassBorder cursor-pointer",
                    hasTickets ? 'bg-primary/20 border-primary/45' : 'bg-surfaceHover/50'
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full absolute top-[3px] transition-all",
                      hasTickets ? 'right-[3px] bg-primary' : 'left-[3px] bg-textMuted'
                    )}
                  />
                </button>
              </div>

              {hasTickets && (
                <div className="space-y-4 pt-4 border-t border-glassBorder">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-textMuted ml-1 block">Preço do ingresso</label>
                    <Input
                      placeholder="Ex: R$ 30,00 ou Lote 1 R$20 / Lote 2 R$30"
                      className="bg-surface border-glassBorder text-textLight"
                      {...register('ticketPrice')}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-medium text-textMuted ml-1 block">Promoters de venda (WhatsApp)</label>
                    {(watch('whatsappContacts') || []).map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          placeholder="Nome"
                          className="flex-1 text-sm font-sans bg-surface border-glassBorder text-textLight"
                          {...register(`whatsappContacts.${i}.name` as const)}
                        />
                        <Input
                          placeholder="(00) 00000-0000"
                          className="flex-1 text-sm font-mono bg-surface border-glassBorder text-textLight"
                          {...register(`whatsappContacts.${i}.phone` as const)}
                        />
                        {(watch('whatsappContacts') || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const current = watch('whatsappContacts') || [];
                              setValue('whatsappContacts', current.filter((_, idx) => idx !== i));
                            }}
                            title="Remover promoter"
                            aria-label="Remover promoter"
                            className="text-danger hover:brightness-110 p-2.5 border border-glassBorder bg-surface hover:bg-surfaceHover rounded-xl transition-all duration-300"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                    {(watch('whatsappContacts') || []).length < 5 && (
                      <button
                        type="button"
                        onClick={() => {
                          const current = watch('whatsappContacts') || [];
                          setValue('whatsappContacts', [...current, { name: '', phone: '' }]);
                        }}
                        className="w-full py-3 rounded-xl border border-dashed border-primary/45 text-primary font-sans font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-primary/10 transition-colors cursor-pointer duration-300"
                      >
                        <Plus size={14} />
                        Adicionar promoter
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Test Event — Admin Only */}
            {userRole === 'admin' && (
              <div className="create-anim flex items-center gap-2.5 md:gap-3.5 surface rounded-2xl p-3.5 md:p-5 text-left">
                <input
                  type="checkbox"
                  id="testEvent"
                  className="accent-primary w-4 h-4 md:w-5 md:h-5 cursor-pointer border border-glassBorder rounded-md"
                  checked={!!isTestEvent}
                  onChange={e => setValue('isTestEvent', e.target.checked, { shouldValidate: true })}
                />
                <label htmlFor="testEvent" className="text-xs md:text-sm text-textMuted flex items-center gap-1.5 md:gap-2 cursor-pointer select-none font-medium">
                  <AlertTriangle size={14} className="text-accent" />
                  Evento de teste (só admin vê)
                </label>
              </div>
            )}

            <div className="create-anim pt-3 md:pt-4">
              <Button type="submit" loading={isSubmitting} fullWidth className="rounded-xl py-3 md:py-4 text-sm md:text-base">
                {isSubmitting ? (isEdit ? 'Salvando...' : 'Criando...') : (isEdit ? 'Salvar alterações' : 'Criar evento')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        )}
      </div>
      <LocationPickerModal
        open={showMapModal}
        endereco={address}
        onPick={({ nome, endereco }) => {
          if (nome) setValue('location', nome);
          setValue('address', endereco, { shouldValidate: true });
        }}
        onClose={() => setShowMapModal(false)}
      />

      <ImageCropModal
        imageSrc={imageSrc}
        uploading={isUploading}
        onConfirm={handleCropConfirm}
        onClose={fecharCrop}
      />

      <DateTimePickerModal
        open={showDatePickerModal}
        date={dateValue}
        time={timeValue}
        onConfirm={(data, hora) => {
          if (data) setValue('date', data, { shouldValidate: true });
          setValue('time', hora, { shouldValidate: true });
          setShowDatePickerModal(false);
        }}
        onClose={() => setShowDatePickerModal(false)}
      />
    </div>
  );
};
