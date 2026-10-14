import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ValidateTickets } from './ValidateTickets';
import { storage } from '../lib/storage';
import type { User } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ eventId: 'event-1' }),
    useNavigate: () => vi.fn(),
  };
});

// Mock AuthContext useAuth
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock storage
vi.mock('../lib/storage', () => ({
  STATUS_AGUARDANDO: 'Aguardando pagamento',
  storage: {
    getEventById: vi.fn(),
    getRegistrationsForEvent: vi.fn(),
    checkInRegistration: vi.fn(),
  },
}));

// Mock @zxing/browser
vi.mock('@zxing/browser', () => {
  return {
    BrowserQRCodeReader: class {
      decodeFromVideoDevice = vi.fn();
    }
  };
});

describe('ValidateTickets Page', () => {
  const mockAdminUser: User = {
    id: 'user-admin',
    name: 'Admin User',
    username: 'admin@example.com',
    role: 'admin',
  };

  const mockEvent = {
    id: 'event-1',
    title: 'Festival de Música',
    creatorId: 'creator-123',
    date: '2026-08-01',
    time: '20:00',
    location: 'Parque de Exposições',
    publicType: 'Aberto' as const,
    description: 'Um ótimo festival de música.',
    tickets: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: mockAdminUser,
      isLoading: false,
      logout: vi.fn(),
      updateUser: vi.fn(),
    });
    vi.mocked(storage.getEventById).mockResolvedValue(mockEvent);
    vi.mocked(storage.getRegistrationsForEvent).mockResolvedValue([]);
  });

  it('renders correctly and loads data', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <ValidateTickets />
        </MemoryRouter>
      );
    });

    expect(screen.getByText('Validar ingressos')).toBeInTheDocument();
    expect(screen.getByText('Festival de Música')).toBeInTheDocument();

    // Verify GPU styling classes are present
    const gpuContainer = screen.getByRole('button', { name: /voltar/i }).closest('header')?.nextElementSibling?.firstElementChild;
    expect(gpuContainer).toHaveClass('gpu-container');

    const videoElement = gpuContainer?.querySelector('video');
    expect(videoElement).toHaveClass('gpu-video');
  });

  it('recusa inscrição sem paymentStatus (presença forjada não é ingresso)', async () => {
    vi.mocked(storage.getRegistrationsForEvent).mockResolvedValue([
      { id: 'event-1_uid-x', eventId: 'event-1', userId: 'uid-x', userName: 'X', timestamp: '2026-08-01T00:00:00Z' },
    ]);
    await act(async () => {
      render(
        <MemoryRouter>
          <ValidateTickets />
        </MemoryRouter>
      );
    });

    fireEvent.click(screen.getByText('Digitar código manualmente'));
    const input = screen.getByPlaceholderText('Cole ou digite o código do ingresso');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'event-1_uid-x' } });
      fireEvent.submit(input.closest('form')!);
    });

    expect(await screen.findByText('Confirmação de presença')).toBeInTheDocument();
    expect(storage.checkInRegistration).not.toHaveBeenCalled();
  });
});
