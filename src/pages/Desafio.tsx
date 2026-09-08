import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Users, CheckCircle2, XCircle, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { estadoDesafio, msRestantes, TAMANHO_GRUPO } from '../lib/desafio';
import type { DesafioMesa } from '../lib/desafio';
import { iniciarDesafio, entrarNoDesafio, ouvirDesafio } from '../lib/storage/desafios';

// Id da mesa vem do QR (ex.: mesa-3). Restrito para não virar id arbitrário de documento.
const MESA_VALIDA = /^[a-z0-9-]{1,30}$/;

const fmt = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const hora = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const Desafio = () => {
  const { mesa = '' } = useParams<{ mesa: string }>();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  // undefined = ainda carregando; null = mesa sem rodada
  const [d, setD] = useState<DesafioMesa | null | undefined>(undefined);
  const [agora, setAgora] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const tentouEntrar = useRef(false);

  const mesaOk = MESA_VALIDA.test(mesa);
  const nomeMesa = mesa.replace(/-/g, ' ');
  const rotaAtual = `/desafio/${mesa}`;
  const irParaLogin = () => navigate(`/login?next=${encodeURIComponent(rotaAtual)}`);

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Só logado lê a mesa (rules); deslogado nem assina — vê a chamada pra entrar.
  useEffect(() => {
    if (!user || !mesaOk) return;
    return ouvirDesafio(mesa, setD);
  }, [user, mesa, mesaOk]);

  const estado = d === undefined ? null : estadoDesafio(d, agora);
  const souMembro = !!(user && d && d.membros.includes(user.id));

  // Chegou pelo link já com conta: entra no grupo sozinho (uma tentativa por rodada).
  useEffect(() => {
    if (!user || !d || estado !== 'aberto' || souMembro || tentouEntrar.current) return;
    tentouEntrar.current = true;
    entrarNoDesafio(mesa, user.id, d.membros.length).catch((e) => {
      console.warn('Não entrou no grupo:', e);
      toast.error('Não deu pra entrar — a mesa fechou ou o tempo acabou.');
    });
  }, [user, d, estado, souMembro, mesa]);
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
      console.error('Início do desafio:', e);
      toast.error('A mesa ainda não reabriu. Tente mais tarde.');
    } finally {
      setBusy(false);
    }
  };

  const chamarAmigos = async () => {
    const url = `${window.location.origin}${rotaAtual}`;
    const text = `Entra aqui AGORA pra gente fechar a mesa e ganhar o refrigerante da Kombi: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Desafio da Kombi', text, url });
      } catch {
        /* usuário cancelou o compartilhamento */
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
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
        <p className="text-xs font-semibold text-accent uppercase tracking-wider">Desafio da Kombi</p>
        <h1 className="font-display font-semibold text-2xl text-textLight mt-1 mb-6 capitalize">{nomeMesa || 'Mesa'}</h1>

        {!mesaOk ? (
          <p className="text-textMuted text-sm">QR Code inválido. Peça outro adesivo na Kombi.</p>
        ) : !user ? (
          !isLoading && (
            <div className="surface rounded-2xl p-6 space-y-4">
              <Flame className="mx-auto text-primary" size={36} />
              <p className="text-sm text-textLight leading-relaxed">
                Junte <strong>5 amigos</strong> da mesa em <strong>5 minutos</strong>, todos com conta no Atchei, e ganhem um refrigerante de 1 L.
              </p>
              <Button variant="primary" fullWidth onClick={irParaLogin} className="py-4 text-sm">
                Entrar para participar
              </Button>
              <p className="text-[11px] text-textMuted">Cria a conta em menos de 1 minuto e volta pra cá sozinho.</p>
            </div>
          )
        ) : estado === null ? (
          <p className="text-textMuted text-sm">Carregando a mesa...</p>
        ) : estado === 'livre' ? (
          <div className="surface rounded-2xl p-6 space-y-4">
            <Flame className="mx-auto text-primary" size={36} />
            <p className="text-sm text-textLight leading-relaxed">
              Você começa o relógio: <strong>5 minutos</strong> pra 4 amigos abrirem o seu link e entrarem no grupo.
            </p>
            <Button variant="primary" fullWidth onClick={comecar} loading={busy} className="py-4 text-sm">
              {d ? 'Começar de novo' : 'Começar desafio'}
            </Button>
          </div>
        ) : estado === 'aberto' && d ? (
          <div className="surface rounded-2xl p-6">
            <div className="font-display font-semibold text-6xl text-primary tabular-nums leading-none">
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
            <p className="text-[11px] text-textMuted mt-3 leading-snug">
              Cada amigo abre o link, cria a conta e já entra no grupo sozinho. O contador sobe aqui na hora.
            </p>
          </div>
        ) : estado === 'liberado' && d ? (
          <div className="rounded-2xl p-8 bg-success text-white shadow-glow-success-lg">
            <CheckCircle2 size={52} className="mx-auto" />
            <h2 className="font-display font-bold text-3xl mt-4 tracking-wide">COCA LIBERADA</h2>
            <p className="mt-2 text-sm capitalize opacity-95">
              {nomeMesa} · liberado às {hora(d.liberadoEmMs ?? agora)}
            </p>
            <p className="text-sm mt-5 opacity-90 leading-relaxed">Mostre esta tela na Kombi pra retirar o refrigerante.</p>
          </div>
        ) : (
          <div className="rounded-2xl p-8 bg-danger text-white">
            <XCircle size={52} className="mx-auto" />
            <h2 className="font-display font-bold text-2xl mt-4 tracking-wide">TENTE NOVAMENTE MAIS TARDE</h2>
            <p className="text-sm mt-3 opacity-90">A mesa não fechou a tempo.</p>
          </div>
        )}

        <button
          onClick={() => navigate('/')}
          className="mt-8 text-xs text-textMuted underline underline-offset-2 hover:text-textLight cursor-pointer"
        >
          Ver os próximos eventos
        </button>
      </div>
    </div>
  );
};
