import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Users, CheckCircle2, XCircle, Flame, Download, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { horaBR } from '../lib/formatters';
import { Button } from '../components/ui/Button';
import { InstallGuideModal } from '../components/InstallGuideModal';
import { useInstalarApp } from '../hooks/useInstalarApp';
import { estadoDesafio, msRestantes, TAMANHO_GRUPO } from '../lib/desafio';
import type { DesafioMesa } from '../lib/desafio';
import { iniciarDesafio, entrarNoDesafio, ouvirDesafio, ouvirGanhador, ouvirAbertura } from '../lib/storage/desafios';

// Id da mesa vem do QR (ex.: mesa-3). Restrito para não virar id arbitrário de documento.
const MESA_VALIDA = /^[a-z0-9-]{1,30}$/;

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const Desafio = () => {
  const { mesa = '' } = useParams<{ mesa: string }>();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  // undefined = ainda carregando; null = mesa sem rodada
  const [d, setD] = useState<DesafioMesa | null | undefined>(undefined);
  const [agora, setAgora] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const tentouEntrar = useRef(false);
  // CTA de instalar o app nas telas finais: a pessoa acabou de ganhar (ou quase) e está com o app aberto.
  const { disponivel: podeInstalar, precisaGuia, instalar } = useInstalarApp();
  const [showGuia, setShowGuia] = useState(false);
  // Carimbo "já ganhou" (1 vitória por conta). undefined = ainda não sabemos.
  const [ganhador, setGanhador] = useState<{ mesa: string; ganhouEmMs: number | null } | null | undefined>(undefined);
  // Interruptor do admin. undefined = ainda lendo.
  const [aberto, setAberto] = useState<boolean | undefined>(undefined);

  const mesaOk = MESA_VALIDA.test(mesa);
  const rotaAtual = `/desafio/${mesa}`;
  const irParaLogin = () => navigate(`/login?next=${encodeURIComponent(rotaAtual)}`);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // O interruptor é público de propósito: quem escaneia sem conta precisa saber que o
  // desafio não está rolando antes de criar login à toa.
  useEffect(() => ouvirAbertura(setAberto), []);

  // Só logado lê a mesa (rules); deslogado nem assina — vê a chamada pra entrar.
  useEffect(() => {
    if (!user || !mesaOk) return;
    return ouvirDesafio(mesa, setD);
  }, [user, mesa, mesaOk]);

  useEffect(() => {
    if (!user) return;
    return ouvirGanhador(user.id, setGanhador);
  }, [user]);

  const estado = d === undefined || aberto === undefined ? null : estadoDesafio(d, agora, aberto);
  const souMembro = !!(user && d && d.membros.includes(user.id));
  // Último estado conhecido, para o tratamento de erro do "Começar" ler sem closure velho.
  const estadoRef = useRef(estado);
  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);

  // Chegou pelo link já com conta: entra no grupo sozinho (uma tentativa por rodada).
  useEffect(() => {
    // Quem já ganhou não entra (as rules recusariam de qualquer jeito).
    if (!user || !d || estado !== 'aberto' || souMembro || ganhador || tentouEntrar.current) return;
    tentouEntrar.current = true;
    entrarNoDesafio(mesa, user.id).catch((e) => {
      console.warn('Não entrou no grupo:', e);
      toast.error('Não deu pra entrar — a mesa fechou ou o tempo acabou.');
    });
  }, [user, d, estado, souMembro, ganhador, mesa]);
  // Rodada nova (iniciadoEm muda) libera nova tentativa.
  useEffect(() => {
    tentouEntrar.current = false;
  }, [d?.iniciadoEmMs]);

  const comecar = async () => {
    if (!user) return irParaLogin();
    setBusy(true);
    try {
      await iniciarDesafio(mesa, user.id);
    } catch (e) {
      // Duas pessoas tocando "Começar" ao mesmo tempo: a segunda é recusada pela regra,
      // mas a rodada da primeira já chegou pelo listener e o auto-entrar a coloca no grupo.
      await new Promise((r) => setTimeout(r, 800));
      if (estadoRef.current === 'aberto') {
        toast.success('Alguém da mesa já começou — você entrou no grupo.');
      } else {
        console.error('Início do desafio:', e);
        toast.error('A mesa ainda não reabriu. Tente mais tarde.');
      }
    } finally {
      setBusy(false);
    }
  };

  const chamarAmigos = async () => {
    const url = `${window.location.origin}${rotaAtual}`;
    const text = `Entra aqui AGORA pra gente fechar a mesa e ganhar o refrigerante da Kombi: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Desafio Atchei', text, url });
      } catch {
        /* usuário cancelou o compartilhamento */
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };

  const instalarApp = async () => {
    // Sem prompt nativo (iOS): abre o passo a passo na hora.
    if (precisaGuia) {
      setShowGuia(true);
      return;
    }
    if ((await instalar()) === 'instalado') toast.success('Atchei adicionado à tela inicial!');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative">
      <button
        onClick={() => navigate('/')}
        className="absolute top-8 left-6 p-2.5 rounded-xl bg-surface border border-glassBorder text-accent hover:border-accent/40 transition-all duration-300 neo-click z-20"
        title="Voltar"
        aria-label="Voltar"
      >
        <ArrowLeft size={20} />
      </button>

      <div className="w-full max-w-sm text-center">
        {/* A mesa fica só no link do QR — a tela não mostra número nenhum. */}
        <h1 className="font-display font-semibold text-2xl text-textLight mb-6">Desafio Atchei</h1>

        {!mesaOk ? (
          <p className="text-textMuted text-sm">QR Code inválido. Peça outro adesivo na Kombi.</p>
        ) : aberto === undefined ? (
          <p className="text-textMuted text-sm">Carregando...</p>
        ) : (!user && !isLoading && !aberto) || estado === 'fechado' ? (
          // Fechado não adianta logar: as rules recusam o início. Logado, só cai aqui via
          // `estado` — quem já ganhou (liberado/entregue) mantém o comprovante mesmo encerrado.
          <div className="surface rounded-2xl p-6 space-y-3">
            <Clock className="mx-auto text-accent" size={36} />
            <p className="text-sm text-textLight leading-relaxed">
              O desafio <strong>não está rolando agora</strong>.
            </p>
            <p className="text-xs text-textMuted">Guarde o QR Code da mesa — quando abrir, é só escanear de novo.</p>
          </div>
        ) : !user ? (
          !isLoading && (
            <div className="surface rounded-2xl p-6 space-y-4">
              <Flame className="mx-auto text-accent" size={36} />
              <p className="text-sm text-textLight leading-relaxed">
                Junte <strong>5 amigos</strong> da mesa em <strong>3 minutos</strong>, todos com conta no Atchei, e ganhem um refrigerante de 1 L.
              </p>
              <Button variant="primary" fullWidth onClick={irParaLogin} className="py-4 text-sm">
                Entrar para participar
              </Button>
              <p className="text-xs text-textMuted">Cria a conta em menos de 1 minuto e volta pra cá sozinho.</p>
            </div>
          )
        ) : estado === null || ganhador === undefined ? (
          <p className="text-textMuted text-sm">Carregando a mesa...</p>
        ) : ganhador && !(estado === 'liberado' && souMembro) ? (
          <div className="surface rounded-2xl p-6 space-y-3">
            <CheckCircle2 className="mx-auto text-success" size={36} />
            <p className="text-sm font-semibold text-textLight">Você já garantiu sua Coca hoje!</p>
            <p className="text-xs text-textMuted leading-relaxed">
              {ganhador.ganhouEmMs ? `Foi às ${horaBR(ganhador.ganhouEmMs)}. ` : ''}Deixa pros outros.
            </p>
          </div>
        ) : estado === 'livre' ? (
          <div className="surface rounded-2xl p-6 space-y-4">
            <Flame className="mx-auto text-accent" size={36} />
            <p className="text-sm text-textLight leading-relaxed">
              Você começa o relógio: <strong>3 minutos</strong> pra 4 amigos abrirem o seu link e entrarem no grupo.
            </p>
            <Button variant="primary" fullWidth onClick={comecar} loading={busy} className="py-4 text-sm">
              {d ? 'Começar de novo' : 'Começar desafio'}
            </Button>
            <p className="text-xs text-textMuted leading-snug">
              Pra retirar, <strong>os 5 mostram a tela verde pessoalmente</strong> pra tia da Kombi.
            </p>
          </div>
        ) : estado === 'aberto' && d ? (
          <div className="surface rounded-2xl p-6">
            <div className="font-display font-semibold text-6xl text-accent tabular-nums leading-none">
              {fmt(msRestantes(d.iniciadoEmMs, agora))}
            </div>
            <p className="text-xs text-textMuted mt-2">pra fechar a mesa</p>

            <div className="flex items-center justify-center gap-2 mt-6 text-3xl font-display font-semibold text-textLight">
              <Users size={26} className="text-accent" />
              {d.membros.length}/{TAMANHO_GRUPO}
            </div>
            <p className="text-xs text-textMuted mt-1">{souMembro ? 'Você está no grupo' : 'Entrando no grupo...'}</p>

            <Button variant="primary" fullWidth onClick={chamarAmigos} className="py-4 text-sm mt-6">
              <Share2 size={16} /> Chamar os amigos
            </Button>
            <p className="text-xs text-textMuted mt-3 leading-snug">
              Cada amigo abre o link, cria a conta e já entra no grupo sozinho. O contador sobe aqui na hora.
            </p>
          </div>
        ) : estado === 'liberado' && d ? (
          souMembro ? (
            <div className="rounded-2xl p-8 bg-success text-white shadow-glow-success-lg">
              <CheckCircle2 size={52} className="mx-auto" />
              <h2 className="font-display font-bold text-3xl mt-4 tracking-wide">COCA LIBERADA</h2>
              <p className="mt-2 text-sm opacity-95">Liberado às {horaBR(d.liberadoEmMs ?? agora)}</p>
              <p className="text-sm mt-5 opacity-95 leading-relaxed">
                <strong>Os 5 do grupo precisam mostrar esta tela, pessoalmente, pra tia da Kombi.</strong>
              </p>
              <p className="text-xs mt-2 opacity-85 leading-relaxed">É 1 refrigerante por mesa — o grupo divide.</p>
            </div>
          ) : (
            // Mesa "queimada": já pagou o prêmio dela. Quem chega depois procura outra.
            <div className="surface rounded-2xl p-6 space-y-3">
              <Flame className="mx-auto text-accent" size={36} />
              <p className="text-sm font-semibold text-textLight">A galera dessa mesa foi rápida e já levou a Coca!</p>
              <p className="text-xs text-textMuted leading-relaxed">Procura outra mesa com o QR e tenta lá.</p>
            </div>
          )
        ) : estado === 'entregue' && d ? (
          <div className="surface rounded-2xl p-8">
            <CheckCircle2 size={44} className="mx-auto text-success" />
            <h2 className="font-display font-semibold text-xl text-textLight mt-4">Refrigerante retirado</h2>
            <p className="text-sm text-textMuted mt-2">Entregue às {horaBR(d.entregueEmMs ?? agora)}</p>
            <p className="text-xs text-textMuted mt-4">Uma mesa, um refrigerante. Valeu por jogar!</p>
          </div>
        ) : (
          <div className="rounded-2xl p-8 bg-danger text-white">
            <XCircle size={52} className="mx-auto" />
            <h2 className="font-display font-bold text-2xl mt-4 tracking-wide">TENTE NOVAMENTE MAIS TARDE</h2>
            <p className="text-sm mt-3 opacity-90">A mesa não fechou a tempo.</p>
          </div>
        )}

        {(estado === 'liberado' || estado === 'entregue' || estado === 'expirado') && podeInstalar && (
          <div className="surface rounded-2xl p-5 mt-5 text-left flex items-start gap-3">
            <Download size={20} className="text-accent shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-textLight leading-snug">
                Adicione o Atchei à tela inicial e não perca nenhum evento
              </p>
              <p className="text-xs text-textMuted mt-1 leading-snug">
                Você recebe aviso dos rolês da região direto no celular.
              </p>
              <Button variant="primary" fullWidth onClick={instalarApp} className="py-3 text-xs mt-3">
                {precisaGuia ? 'Como adicionar' : 'Adicionar à tela inicial'}
              </Button>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          className="mt-8 text-xs text-textMuted underline underline-offset-2 hover:text-textLight cursor-pointer"
        >
          Ver os próximos eventos
        </button>
      </div>

      <InstallGuideModal open={showGuia} onClose={() => setShowGuia(false)} />
    </div>
  );
};
