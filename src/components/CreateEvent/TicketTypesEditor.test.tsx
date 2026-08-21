import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TicketTypesEditor } from './TicketTypesEditor';
import type { TicketType } from '../../lib/storage';

// Preço e capacidade chegam do <input type="number"> como string e viram o preço
// autoritativo do lote no Firestore — errar a conversão vira cobrança errada.
describe('TicketTypesEditor', () => {
  const lote = (over: Partial<TicketType> = {}): TicketType => ({
    id: 'tkt-1', name: 'VIP', price: 50, capacity: 100, sold: 0, status: 'active', ...over,
  });

  const onChange = vi.fn();
  beforeEach(() => { vi.clearAllMocks(); });

  it('mostra o estado vazio quando não há lotes', () => {
    render(<TicketTypesEditor tickets={[]} onChange={onChange} />);
    expect(screen.getByText(/Nenhum lote ou setor configurado/)).toBeInTheDocument();
  });

  it('adiciona um lote com padrões utilizáveis', () => {
    render(<TicketTypesEditor tickets={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText(/Adicionar lote\/setor/));

    const [novos] = onChange.mock.calls[0];
    expect(novos).toHaveLength(1);
    expect(novos[0]).toMatchObject({ name: '', price: 0, capacity: 100, status: 'active' });
    expect(novos[0].id).toMatch(/^tkt-/);
  });

  it('converte preço e capacidade para número', () => {
    render(<TicketTypesEditor tickets={[lote()]} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText('5.00'), { target: { value: '75.5' } });
    expect(onChange.mock.calls[0][0][0].price).toBe(75.5);

    fireEvent.change(screen.getByPlaceholderText('100'), { target: { value: '250' } });
    expect(onChange.mock.calls[1][0][0].capacity).toBe(250);
  });

  it('preço inválido vira 0 em vez de NaN', () => {
    render(<TicketTypesEditor tickets={[lote()]} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('5.00'), { target: { value: 'abc' } });
    expect(onChange.mock.calls[0][0][0].price).toBe(0);
  });

  it('o nome continua string, sem conversão numérica', () => {
    render(<TicketTypesEditor tickets={[lote()]} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('Ex: VIP - 1º Lote'), { target: { value: 'Camarote' } });
    expect(onChange.mock.calls[0][0][0].name).toBe('Camarote');
  });

  it('remove só o lote clicado e preserva os demais', () => {
    const lotes = [lote({ id: 'a', name: 'A' }), lote({ id: 'b', name: 'B' }), lote({ id: 'c', name: 'C' })];
    render(<TicketTypesEditor tickets={lotes} onChange={onChange} />);

    fireEvent.click(screen.getAllByLabelText('Remover lote')[1]);
    expect(onChange.mock.calls[0][0].map((t: TicketType) => t.name)).toEqual(['A', 'C']);
  });

  it('editar um lote não altera os vizinhos nem perde o `sold`', () => {
    const lotes = [lote({ id: 'a', name: 'A', sold: 7 }), lote({ id: 'b', name: 'B', sold: 3 })];
    render(<TicketTypesEditor tickets={lotes} onChange={onChange} />);

    fireEvent.change(screen.getAllByPlaceholderText('5.00')[0], { target: { value: '99' } });
    const [resultado] = onChange.mock.calls[0];
    expect(resultado[0]).toMatchObject({ name: 'A', price: 99, sold: 7 });
    expect(resultado[1]).toEqual(lotes[1]);
  });
});
