import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Register } from './Register';
import { storage } from '../lib/storage';

// Mock react-router-dom useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock storage
vi.mock('../lib/storage', () => ({
  storage: {
    register: vi.fn(),
  },
}));

describe('Register Page', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  const fillForm = async () => {
    await userEvent.type(screen.getByPlaceholderText('Seu nome'), 'Maria Souza');
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '1990-05-10' } });
    await userEvent.type(screen.getByPlaceholderText('Seu e-mail'), 'maria@example.com');
    await userEvent.type(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
  };

  it('renders form with profile type selector defaulting to personal', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    expect(screen.getByRole('radio', { name: /pessoal/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /profissional/i })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByPlaceholderText('Seu nome')).toBeInTheDocument();
  });

  it('registers a personal account and redirects to feed', async () => {
    vi.mocked(storage.register).mockResolvedValue({
      id: 'user-1',
      name: 'Maria Souza',
      username: 'maria@example.com',
      role: 'user',
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(storage.register).toHaveBeenCalledWith('maria@example.com', 'senha123', 'Maria Souza', 'user', '1990-05-10');
    expect(mockNavigate).toHaveBeenCalledWith('/feed');
  });

  it('registers a professional account when that type is selected', async () => {
    vi.mocked(storage.register).mockResolvedValue({
      id: 'user-2',
      name: 'Maria Souza',
      username: 'maria@example.com',
      role: 'partner',
    });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('radio', { name: /profissional/i }));
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(storage.register).toHaveBeenCalledWith('maria@example.com', 'senha123', 'Maria Souza', 'profissional', '1990-05-10');
  });

  it('blocks registration when the user is under 18', async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    const dezesseteAnosAtras = new Date();
    dezesseteAnosAtras.setFullYear(dezesseteAnosAtras.getFullYear() - 17);

    await userEvent.type(screen.getByPlaceholderText('Seu nome'), 'Maria Souza');
    fireEvent.change(screen.getByLabelText('Data de nascimento'), {
      target: { value: dezesseteAnosAtras.toISOString().slice(0, 10) },
    });
    await userEvent.type(screen.getByPlaceholderText('Seu e-mail'), 'maria@example.com');
    await userEvent.type(screen.getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
    await userEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(toast.error).toHaveBeenCalledWith('Você precisa ter 18 anos ou mais para criar uma conta.');
    expect(storage.register).not.toHaveBeenCalled();
  });

  it('shows a friendly error when the email is already in use', async () => {
    vi.mocked(storage.register).mockRejectedValue({ code: 'auth/email-already-in-use' });

    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    );

    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: /criar conta/i }));

    expect(toast.error).toHaveBeenCalledWith('Este e-mail já está em uso. Tente fazer login.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
