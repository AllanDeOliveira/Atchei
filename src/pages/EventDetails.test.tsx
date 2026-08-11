import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EventDetails } from './EventDetails';
import { storage } from '../lib/storage';
import type { User, EventItem } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'event-1' }),
    useNavigate: () => vi.fn(),
  };
});

// Mock AuthContext useAuth
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Mock storage
vi.mock('../lib/storage', () => ({
  storage: {
    getEvents: vi.fn(),
    getCurrentUser: vi.fn(),
    getProfileById: vi.fn(),
    hasUserRegistered: vi.fn(),
  },
}));

// Mock Firebase SDKs

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  onSnapshot: vi.fn(() => vi.fn()),
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({
  db: {},
  getFunctionsInstance: vi.fn(),
}));

describe('EventDetails Page', () => {
  const mockUser: User = {
    id: 'user-123',
    name: 'Test User',
    username: 'test@example.com',
    role: 'user',
  };

  const mockEvent: EventItem = {
    id: 'event-1',
    title: 'Festival de Música Sertaneja',
    date: '2026-07-20',
    time: '18:00',
    location: 'Parque de Exposições',
    address: 'Av. Brasil, 1000',
    mediaUrls: [],
    publicType: 'Geral',
    description: 'Um ótimo festival de música.',
    creatorId: 'creator-1',
    registrationCount: 5,
    pixTicketPrice: '100',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isLoading: false,
      logout: vi.fn(),
      updateUser: vi.fn(),
    });
    vi.mocked(storage.getEvents).mockResolvedValue([mockEvent]);
    vi.mocked(storage.getCurrentUser).mockReturnValue(mockUser);
    vi.mocked(storage.getProfileById).mockResolvedValue({
      id: 'creator-1',
      name: 'Organizador Teste',
      type: 'estabelecimento',
      description: '',
    });
    vi.mocked(storage.hasUserRegistered).mockResolvedValue(false);
  });

  it('renders event details correctly', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <EventDetails />
        </MemoryRouter>
      );
    });

    expect(screen.getByText('Festival de Música Sertaneja')).toBeInTheDocument();
    expect(screen.getAllByText('Parque de Exposições')[0]).toBeInTheDocument();
  });
});
