import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventTicketSection } from './EventTicketSection';
import type { EventItem, User } from '../../lib/storage';

describe('EventTicketSection Component', () => {
  const mockEvent: EventItem = {
    id: 'event-1',
    title: 'Evento Teste',
    date: '2026-08-01',
    time: '20:00',
    location: 'Local Teste',
    address: 'Endereço Teste',
    description: 'Descrição',
    publicType: 'Geral',
    creatorId: 'user-1',
    hasPresence: true,
    hasPixTickets: true,
    pixTicketPrice: '50',
  };

  const mockUser: User = {
    id: 'admin-1',
    name: 'Admin User',
    username: 'admin@test.com',
    role: 'admin',
  };

  // Os handlers de mockProps são compartilhados entre os testes; sem o reset,
  // um clique de um teste conta como chamada no seguinte.
  beforeEach(() => { vi.clearAllMocks(); });

  const mockProps = {
    event: mockEvent,
    currentUser: mockUser,
    isRegistered: false,
    loadingTestTicket: false,
    onOpenFreeTicketModal: vi.fn(),
    onOpenPixModal: vi.fn(),
    onOpenContactsModal: vi.fn(),
    onGerarIngressoTeste: vi.fn(),
  };

  it('renders ticket price and action buttons for un-registered user', () => {
    render(<EventTicketSection {...mockProps} />);
    expect(screen.getByText('Confirmar presença')).toBeInTheDocument();
    expect(screen.getByText('Gerar ingresso de teste (admin)')).toBeInTheDocument();
  });

  it('renders confirmed status when user is registered', () => {
    render(<EventTicketSection {...mockProps} isRegistered={true} />);
    expect(screen.getByText('Presença confirmada · ingresso garantido')).toBeInTheDocument();
  });

  it('abre o checkout Pix quando o evento tem ingressos via Pix', () => {
    render(<EventTicketSection {...mockProps} />);
    fireEvent.click(screen.getByText('Comprar via Pix'));
    expect(mockProps.onOpenPixModal).toHaveBeenCalled();
  });

  // Evento sem Pix continua caindo no WhatsApp — a flag liga o Pix, não o remove.
  it('cai para WhatsApp quando o evento nao tem ingressos via Pix', () => {
    const semPix = { ...mockProps.event, hasPixTickets: false, hasTickets: true };
    render(<EventTicketSection {...mockProps} event={semPix} />);
    expect(screen.queryByText('Comprar via Pix')).toBeNull();
    expect(screen.getByText('Comprar ingresso')).toBeInTheDocument();
    expect(mockProps.onOpenPixModal).not.toHaveBeenCalled();
  });
});
