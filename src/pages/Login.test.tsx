import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Login } from './Login';
import { storage } from '../lib/storage';
import { sendPasswordResetEmail } from 'firebase/auth';

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

// O reset de senha usa o envio NATIVO do Firebase (sendPasswordResetEmail).
vi.mock('../lib/firebase', () => ({
  auth: {},
}));

vi.mock('firebase/auth', () => ({
  sendPasswordResetEmail: vi.fn(),
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
    expect(toast.error).toHaveBeenCalledWith('Credenciais inválidas!');
  });

  it('chama sendPasswordResetEmail com o e-mail digitado', async () => {
    vi.mocked(sendPasswordResetEmail).mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText('Seu e-mail'), '  Pessoa@Exemplo.com  ');
    await userEvent.click(screen.getByRole('button', { name: /esqueci minha senha/i }));

    expect(sendPasswordResetEmail).toHaveBeenCalledWith({}, 'Pessoa@Exemplo.com');
    expect(toast.success).toHaveBeenCalledWith(
      'Se o e-mail estiver cadastrado, você receberá o link de redefinição.'
    );
  });

  it('não envia quando o campo de e-mail está vazio', async () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await userEvent.click(screen.getByRole('button', { name: /esqueci minha senha/i }));

    expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Digite seu e-mail acima para recuperar a senha.');
  });

  // Conta inexistente responde igual a envio feito — anti-enumeração de e-mails.
  it('responde neutro quando a conta não existe', async () => {
    vi.mocked(sendPasswordResetEmail).mockRejectedValue({ code: 'auth/user-not-found' });

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await userEvent.type(screen.getByPlaceholderText('Seu e-mail'), 'ninguem@exemplo.com');
    await userEvent.click(screen.getByRole('button', { name: /esqueci minha senha/i }));

    expect(toast.success).toHaveBeenCalledWith(
      'Se o e-mail estiver cadastrado, você receberá o link de redefinição.'
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  // A mensagem de sucesso é neutra por design (anti-enumeração), mas falha de rede
  // precisa aparecer — senão o usuário acha que o link foi enviado e nunca chega.
  it('avisa quando a chamada falha por rede', async () => {
    vi.mocked(sendPasswordResetEmail).mockRejectedValue(new Error('offline'));

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
