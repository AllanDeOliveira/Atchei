import { describe, it, expect, vi } from 'vitest';
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
    expect(screen.getByText('Comprar via Pix')).toBeInTheDocument();
    expect(screen.getByText('Gerar ingresso de teste (admin)')).toBeInTheDocument();
  });

  it('renders confirmed status when user is registered', () => {
    render(<EventTicketSection {...mockProps} isRegistered={true} />);
    expect(screen.getByText('Presença confirmada · ingresso garantido')).toBeInTheDocument();
  });

  it('triggers onOpenPixModal when Pix button clicked', () => {
    render(<EventTicketSection {...mockProps} />);
    const pixBtn = screen.getByText('Comprar via Pix');
    fireEvent.click(pixBtn);
    expect(mockProps.onOpenPixModal).toHaveBeenCalled();
  });
});
