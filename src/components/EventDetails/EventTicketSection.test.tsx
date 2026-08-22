import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventTicketSection } from './EventTicketSection';
import type { EventItem, User, Registration } from '../../lib/storage';

// PIX_ENABLED é constante de build: sem mock, estes testes passariam a depender do
// valor real da flag e quebrariam a cada stand-by das vendas. Cada caso declara o
// estado que está exercitando.
const mockFlags = vi.hoisted(() => ({ PIX_ENABLED: true }));
vi.mock('../../lib/flags', () => mockFlags);

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
  // A flag é objeto simples: clearAllMocks não a restaura, e sem este reset o
  // resultado passaria a depender da ordem de execução dos testes.
  beforeEach(() => { vi.clearAllMocks(); mockFlags.PIX_ENABLED = true; });

  const mockProps = {
    event: mockEvent,
    currentUser: mockUser,
    myRegistration: null as Registration | null,
    loadingTestTicket: false,
    onConfirmPresence: vi.fn(),
    onCancelPresence: vi.fn(),
    onOpenPixModal: vi.fn(),
    onOpenContactsModal: vi.fn(),
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

  it('abre o checkout Pix quando o evento tem ingressos via Pix', () => {
    mockFlags.PIX_ENABLED = true;
    render(<EventTicketSection {...mockProps} />);
    fireEvent.click(screen.getByText('Comprar via Pix'));
    expect(mockProps.onOpenPixModal).toHaveBeenCalled();
  });

  // Stand-by das vendas: some o botão mesmo em evento configurado com Pix.
  it('esconde a compra via Pix quando a flag esta desligada', () => {
    mockFlags.PIX_ENABLED = false;
    render(<EventTicketSection {...mockProps} />);
    expect(screen.queryByText('Comprar via Pix')).toBeNull();
    expect(mockProps.onOpenPixModal).not.toHaveBeenCalled();
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
