import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Login } from './Login';
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
    login: vi.fn(),
  },
}));

// O reset de senha passa pela function `solicitarResetSenha`, não pelo SDK do Auth.
vi.mock('../lib/firebase', () => ({
  getFunctionsInstance: vi.fn(() => ({})),
}));

const mockCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(() => mockCallable),
}));

describe('Login Page', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
  });

  it('renders login form items', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByPlaceholderText('Seu e-mail')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Sua senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('performs successful login and redirects to feed', async () => {
    vi.mocked(storage.login).mockResolvedValue({
      id: 'user-123',
      name: 'João Silva',
      username: 'joao@example.com',
      role: 'user',
      mustChangePassword: false,
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('Seu e-mail');
    const passwordInput = screen.getByPlaceholderText('Sua senha');
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    await userEvent.type(emailInput, 'joao@example.com');
    await userEvent.type(passwordInput, 'senha123');
    await userEvent.click(submitButton);

    expect(storage.login).toHaveBeenCalledWith('joao@example.com', 'senha123');
    expect(toast.success).toHaveBeenCalledWith('Bem-vindo de volta!');
    expect(mockNavigate).toHaveBeenCalledWith('/feed');
  });

  it('redirects to change-password if mustChangePassword is true', async () => {
    vi.mocked(storage.login).mockResolvedValue({
      id: 'user-456',
      name: 'Parceiro Novo',
      username: 'parceiro@example.com',
      role: 'partner',
      mustChangePassword: true,
    });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('Seu e-mail');
    const passwordInput = screen.getByPlaceholderText('Sua senha');
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    await userEvent.type(emailInput, 'parceiro@example.com');
    await userEvent.type(passwordInput, 'senhaTemp');
    await userEvent.click(submitButton);

    expect(storage.login).toHaveBeenCalledWith('parceiro@example.com', 'senhaTemp');
    expect(mockNavigate).toHaveBeenCalledWith('/change-password');
  });

  it('shows error toast when login returns null', async () => {
    vi.mocked(storage.login).mockResolvedValue(null);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText('Seu e-mail');
    const passwordInput = screen.getByPlaceholderText('Sua senha');
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    await userEvent.type(emailInput, 'errado@example.com');
    await userEvent.type(passwordInput, 'senhaErrada');
    await userEvent.click(submitButton);

    expect(storage.login).toHaveBeenCalledWith('errado@example.com', 'senhaErrada');
    expect(toast.error).toHaveBeenCalledWith('Senha ou Email incorreto!');
  });

  it('chama solicitarResetSenha com o e-mail digitado', async () => {
    mockCallable.mockResolvedValue({ data: { ok: true } });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText('Seu e-mail'), '  Pessoa@Exemplo.com  ');
    await userEvent.click(screen.getByRole('button', { name: /esqueci minha senha/i }));

    expect(mockCallable).toHaveBeenCalledWith({ email: 'Pessoa@Exemplo.com' });
    expect(toast.success).toHaveBeenCalledWith(
      'Se o e-mail estiver cadastrado, você receberá o link de redefinição.'
    );
  });

  it('não chama a function quando o campo de e-mail está vazio', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: /esqueci minha senha/i }));

    expect(mockCallable).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Digite seu e-mail acima para recuperar a senha.');
  });

  // A mensagem de sucesso é neutra por design (anti-enumeração), mas falha de rede
  // precisa aparecer — senão o usuário acha que o link foi enviado e nunca chega.
  it('avisa quando a chamada falha por rede', async () => {
    mockCallable.mockRejectedValue(new Error('offline'));

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText('Seu e-mail'), 'pessoa@exemplo.com');
    await userEvent.click(screen.getByRole('button', { name: /esqueci minha senha/i }));

    expect(toast.error).toHaveBeenCalledWith('Falha ao enviar. Verifique a conexão e tente novamente.');
    expect(toast.success).not.toHaveBeenCalled();
  });
});
