import { Plus, Trash2 } from 'lucide-react';
import { Input } from '../ui/Input';
import type { TicketType } from '../../lib/storage';

interface Props {
  tickets: TicketType[];
  onChange: (tickets: TicketType[]) => void;
}

/** Lotes/setores de ingresso do evento (nome, preço e capacidade). */
export const TicketTypesEditor = ({ tickets, onChange }: Props) => {
  const adicionar = () =>
    onChange([
      ...tickets,
      { id: `tkt-${crypto.randomUUID()}`, name: '', price: 0, capacity: 100, sold: 0, status: 'active' },
    ]);

  const remover = (index: number) => onChange(tickets.filter((_, i) => i !== index));

  // `price` e `capacity` chegam do <input type="number"> como string.
  const atualizar = (index: number, campo: 'name' | 'price' | 'capacity', valor: string) =>
    onChange(
      tickets.map((t, i) => {
        if (i !== index) return t;
        if (campo === 'name') return { ...t, name: valor };
        return { ...t, [campo]: Number(valor) || 0 };
      })
    );

  return (
    <div className="space-y-3 pt-4 border-t border-glassBorder/40">
      <div className="flex justify-between items-center">
        <label className="text-xs font-medium text-textMuted ml-1 block">Setores e lotes de ingressos</label>
        <button
          type="button"
          onClick={adicionar}
          className="py-1.5 px-3 bg-success/15 border border-success/35 text-success rounded-xl font-sans text-[11px] font-semibold hover:bg-success/20 transition-all flex items-center gap-1 cursor-pointer"
        >
          <Plus size={10} /> Adicionar lote/setor
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="text-center py-4 bg-surfaceHover/30 rounded-xl border border-dashed border-glassBorder text-[11px] text-textMuted">
          Nenhum lote ou setor configurado. Cadastre lotes para habilitar múltiplos preços.
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t, idx) => (
            <div key={t.id || idx} className="flex gap-2 items-end bg-surface p-3 rounded-2xl border border-glassBorder">
              <div className="flex-1 space-y-1">
                <label className="text-[11px] font-medium text-textMuted ml-1 block">Nome / lote</label>
                <Input
                  placeholder="Ex: VIP - 1º Lote"
                  className="text-xs bg-surface border-glassBorder text-textLight"
                  value={t.name}
                  onChange={e => atualizar(idx, 'name', e.target.value)}
                />
              </div>
              <div className="w-24 space-y-1">
                <label className="text-[11px] font-medium text-textMuted ml-1 block">Preço (R$)</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  className="text-xs bg-surface border-glassBorder text-textLight"
                  value={t.price || ''}
                  onChange={e => atualizar(idx, 'price', e.target.value)}
                />
              </div>
              <div className="w-20 space-y-1">
                <label className="text-[11px] font-medium text-textMuted ml-1 block">Capacidade</label>
                <Input
                  type="number"
                  placeholder="100"
                  className="text-xs bg-surface border-glassBorder text-textLight"
                  value={t.capacity || ''}
                  onChange={e => atualizar(idx, 'capacity', e.target.value)}
                />
              </div>
              <button
                type="button"
                onClick={() => remover(idx)}
                title="Remover lote"
                aria-label="Remover lote"
                className="text-danger hover:brightness-110 p-2.5 border border-glassBorder bg-surface hover:bg-surfaceHover rounded-xl transition-all duration-300 cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
