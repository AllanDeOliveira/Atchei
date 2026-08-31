import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventTicketSection } from './EventTicketSection';
import type { EventItem, User, Registration } from '../../lib/storage';

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
    hasTickets: true,
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
    myRegistration: null as Registration | null,
    loadingTestTicket: false,
    onConfirmPresence: vi.fn(),
    onCancelPresence: vi.fn(),
    onWhatsAppBuy: vi.fn(),
    onGerarIngressoTeste: vi.fn(),
  };

  const regGratuita: Registration = {
    id: 'reg-1',
    eventId: 'event-1',
    userId: 'admin-1',
    userName: 'Admin User',
    userEmail: 'admin@test.com',
    paymentStatus: 'Gratuito',
    timestamp: '2026-08-01T00:00:00.000Z',
  };

  it('renders ticket price and action buttons for un-registered user', () => {
    render(<EventTicketSection {...mockProps} />);
    expect(screen.getByText(/Confirmar presença/)).toBeInTheDocument();
    expect(screen.getByText('Gerar ingresso de teste (admin)')).toBeInTheDocument();
  });

  it('confirma presença em 1 toque (sem modal)', () => {
    render(<EventTicketSection {...mockProps} />);
    fireEvent.click(screen.getByText(/Confirmar presença/));
    expect(mockProps.onConfirmPresence).toHaveBeenCalled();
  });

  it('presença gratuita mostra estado confirmado com opção de cancelar', () => {
    render(<EventTicketSection {...mockProps} myRegistration={regGratuita} />);
    expect(screen.getByText('Presença confirmada!')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancelar presença'));
    expect(mockProps.onCancelPresence).toHaveBeenCalled();
  });

  it('ingresso pago mostra estado garantido SEM opção de cancelar', () => {
    render(<EventTicketSection {...mockProps} myRegistration={{ ...regGratuita, paymentStatus: 'Pago' }} />);
    expect(screen.getByText('Presença confirmada · ingresso garantido')).toBeInTheDocument();
    expect(screen.queryByText('Cancelar presença')).toBeNull();
  });

  it('mostra prova social a partir de 3 confirmados', () => {
    render(<EventTicketSection {...mockProps} event={{ ...mockEvent, registrationCount: 23 }} />);
    expect(screen.getByText(/Mais de 20 pessoas confirmadas/)).toBeInTheDocument();
  });

  it('compra via WhatsApp quando o evento vende ingressos', () => {
    render(<EventTicketSection {...mockProps} />);
    fireEvent.click(screen.getByText('Comprar ingresso'));
    expect(mockProps.onWhatsAppBuy).toHaveBeenCalled();
  });

  it('sem venda de ingressos, não mostra o botão de compra', () => {
    const semVenda = { ...mockProps.event, hasTickets: false };
    render(<EventTicketSection {...mockProps} event={semVenda} />);
    expect(screen.queryByText('Comprar ingresso')).toBeNull();
  });

  // Intenção via WhatsApp ainda não confirmada: sem ingresso garantido, com
  // atalho para o chat e opção de desistir.
  it('mostra estado aguardando vendedor para intencao WhatsApp pendente', () => {
    render(<EventTicketSection {...mockProps} myRegistration={{ ...regGratuita, paymentStatus: 'Aguardando pagamento' }} />);
    expect(screen.getByText('Aguardando confirmação do vendedor')).toBeInTheDocument();
    expect(screen.queryByText('Presença confirmada · ingresso garantido')).toBeNull();

    fireEvent.click(screen.getByText('Falar com o vendedor no WhatsApp'));
    expect(mockProps.onWhatsAppBuy).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Desistir da compra'));
    expect(mockProps.onCancelPresence).toHaveBeenCalled();
  });
});
