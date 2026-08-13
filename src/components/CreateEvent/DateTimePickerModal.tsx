import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, CalendarPlus, Clock } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';

interface Props {
  open: boolean;
  /** Data atual no formato do formulário (YYYY-MM-DD). */
  date: string;
  /** Horário atual (HH:MM). */
  time: string;
  onConfirm: (date: string, time: string) => void;
  onClose: () => void;
}

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

type Celula = { day: number; isCurrentMonth: boolean; date: Date };

/** Grade fixa de 42 células (6 semanas), preenchendo as bordas com os meses vizinhos. */
const gerarCelulas = (mesRef: Date): Celula[] => {
  const year = mesRef.getFullYear();
  const month = mesRef.getMonth();
  const diasNoMes = new Date(year, month + 1, 0).getDate();
  const primeiroDia = new Date(year, month, 1).getDay();

  const celulas: Celula[] = [];
  for (let i = primeiroDia; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    celulas.push({ day: d.getDate(), isCurrentMonth: false, date: d });
  }
  for (let d = 1; d <= diasNoMes; d++) {
    celulas.push({ day: d, isCurrentMonth: true, date: new Date(year, month, d) });
  }
  for (let d = 1; celulas.length < 42; d++) {
    celulas.push({ day: d, isCurrentMonth: false, date: new Date(year, month + 1, d) });
  }
  return celulas;
};

const paraISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const mesmoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const paraData = (iso: string): Date => {
  const partes = iso.split('-');
  return partes.length === 3
    ? new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]))
    : new Date();
};

/**
 * Seletor de data e horário em um único diálogo (o nativo do iOS é inconsistente).
 * O conteúdo só monta quando `open` é true, então o estado inicializa a partir do
 * formulário no próprio `useState` — sem efeito de sincronização.
 */
export const DateTimePickerModal = ({ open, ...props }: Props) =>
  open ? <Conteudo {...props} /> : null;

const Conteudo = ({ date, time, onConfirm, onClose }: Omit<Props, 'open'>) => {
  const inicial = paraData(date);
  const [mesAtual, setMesAtual] = useState<Date>(new Date(inicial.getFullYear(), inicial.getMonth(), 1));
  const [dataSel, setDataSel] = useState<Date | null>(inicial);
  const [horaSel, setHoraSel] = useState(time || '20:00');

  useEscapeToClose(true, onClose);

  const celulas = gerarCelulas(mesAtual);
  const hoje = new Date();
  const [hh, mm] = horaSel.split(':');

  const passoMes = (delta: number) =>
    setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));

  // Roda o relógio: 23h + 1 volta para 0h, 55min + 5 volta para 0min.
  const ajustarHora = (campo: 'h' | 'm', delta: number) => {
    let h = Number(hh);
    let m = Number(mm);
    if (campo === 'h') h = (h + delta + 24) % 24;
    else m = (m + delta + 60) % 60;
    setHoraSel(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  // Digitação direta: só dígitos, últimos 2, limitado a 23h/59min. Se os 2 últimos
  // estouram o limite (ex.: '23'+'1' → 31), vale só o último dígito — sem isso o campo
  // fica preso em 23/59 digitando com o cursor no fim (e no iOS, onde o select() do
  // focus não segura, digitar sempre acrescenta em vez de substituir).
  const digitarHora = (campo: 'h' | 'm', valor: string) => {
    const digitos = valor.replace(/\D/g, '');
    const max = campo === 'h' ? 23 : 59;
    let num = Number(digitos.slice(-2) || '0');
    if (num > max) num = Number(digitos.slice(-1));
    const v = String(num).padStart(2, '0');
    setHoraSel(campo === 'h' ? `${v}:${mm}` : `${hh}:${v}`);
  };

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[99999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="datepicker-title"
    >
      <div className="bg-background w-full max-w-sm rounded-3xl border border-glassBorder shadow-md p-6 relative animate-in zoom-in duration-300">
        <div className="flex justify-between items-center mb-5">
          <div className="text-left">
            <h3 id="datepicker-title" className="font-display font-semibold text-xl text-textLight">Data e horário</h3>
            <p className="text-xs text-textMuted">Quando o evento acontece</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-primary/10 p-2.5 rounded-full text-primary hover:bg-primary/20 active:scale-95 transition-all cursor-pointer"
            title="Fechar"
            aria-label="Fechar seletor de data"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => passoMes(-1)}
            className="p-2 rounded-xl bg-surface border border-glassBorder text-textLight hover:border-primary/40 transition-all cursor-pointer"
            title="Mês anterior"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="font-display font-semibold text-sm text-textLight">
            {MESES[mesAtual.getMonth()]} {mesAtual.getFullYear()}
          </span>
          <button
            type="button"
            onClick={() => passoMes(1)}
            className="p-2 rounded-xl bg-surface border border-glassBorder text-textLight hover:border-primary/40 transition-all cursor-pointer"
            title="Próximo mês"
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {SEMANA.map((d, i) => (
            <span key={i} className="text-[10px] font-semibold text-textMuted text-center py-1">{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 mb-5">
          {celulas.map((c, i) => {
            const selecionado = dataSel && mesmoDia(c.date, dataSel);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setDataSel(c.date)}
                className={cn(
                  'aspect-square rounded-lg text-xs font-medium transition-all cursor-pointer tabular-nums',
                  !c.isCurrentMonth && 'text-textMuted/35',
                  c.isCurrentMonth && !selecionado && 'text-textLight hover:bg-surfaceHover',
                  selecionado && 'bg-primary text-textDark font-bold',
                  !selecionado && mesmoDia(c.date, hoje) && 'border border-primary/40'
                )}
              >
                {c.day}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-center gap-3 mb-6 surface rounded-2xl py-4">
          <Clock size={15} className="text-primary mr-1" />
          {(['h', 'm'] as const).map((campo, idx) => (
            <div key={campo} className="flex items-center gap-3">
              {idx === 1 && <span className="font-display font-bold text-xl text-textLight">:</span>}
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => ajustarHora(campo, campo === 'h' ? 1 : 5)}
                  className="text-textMuted hover:text-primary transition-colors cursor-pointer"
                  title={campo === 'h' ? 'Aumentar hora' : 'Aumentar minuto'}
                  aria-label={campo === 'h' ? 'Aumentar hora' : 'Aumentar minuto'}
                >
                  <ChevronUp size={16} />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={campo === 'h' ? hh : mm}
                  onChange={e => digitarHora(campo, e.target.value)}
                  onFocus={e => e.target.select()}
                  className="font-display font-bold text-xl text-textLight tabular-nums w-8 text-center bg-transparent rounded-md focus:outline-none focus:ring-1 focus:ring-primary/50"
                  aria-label={campo === 'h' ? 'Hora' : 'Minuto'}
                />
                <button
                  type="button"
                  onClick={() => ajustarHora(campo, campo === 'h' ? -1 : -5)}
                  className="text-textMuted hover:text-primary transition-colors cursor-pointer"
                  title={campo === 'h' ? 'Diminuir hora' : 'Diminuir minuto'}
                  aria-label={campo === 'h' ? 'Diminuir hora' : 'Diminuir minuto'}
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <Button
          type="button"
          fullWidth
          className="rounded-xl py-3.5"
          onClick={() => onConfirm(dataSel ? paraISO(dataSel) : '', horaSel)}
        >
          <CalendarPlus size={16} />
          Confirmar
        </Button>
      </div>
    </div>
  );
};
