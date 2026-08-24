import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthAction } from './AuthAction';
import { verifyPasswordResetCode, confirmPasswordReset, applyActionCode } from 'firebase/auth';

vi.mock('../lib/firebase', () => ({ auth: {} }));

vi.mock('firebase/auth', () => ({
  verifyPasswordResetCode: vi.fn(),
  confirmPasswordReset: vi.fn(),
  applyActionCode: vi.fn(),
}));

const renderEm = (query: string) =>
  render(
    <MemoryRouter initialEntries={[`/auth/action${query}`]}>
      <Routes>
        <Route path="/auth/action" element={<AuthAction />} />
        <Route path="/login" element={<div>pagina de login</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('AuthAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pede a nova senha mostrando o e-mail que o código identifica', async () => {
    vi.mocked(verifyPasswordResetCode).mockResolvedValue('alguem@exemplo.com');

    renderEm('?mode=resetPassword&oobCode=abc123');

    expect(await screen.findByText('alguem@exemplo.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar nova senha/i })).toBeInTheDocument();
  });

  it('conclui a redefinição com o código do link', async () => {
    vi.mocked(verifyPasswordResetCode).mockResolvedValue('alguem@exemplo.com');
    vi.mocked(confirmPasswordReset).mockResolvedValue(undefined);

    renderEm('?mode=resetPassword&oobCode=abc123');
    await screen.findByText('alguem@exemplo.com');

    fireEvent.change(screen.getByPlaceholderText(/mínimo 6 caracteres/i), { target: { value: 'senhanova1' } });
    fireEvent.change(screen.getByPlaceholderText(/repita a nova senha/i), { target: { value: 'senhanova1' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar nova senha/i }));

    await waitFor(() => expect(confirmPasswordReset).toHaveBeenCalledWith({}, 'abc123', 'senhanova1'));
    expect(await screen.findByText('Senha alterada')).toBeInTheDocument();
  });

  it('recusa senhas que não coincidem sem chamar o Firebase', async () => {
    vi.mocked(verifyPasswordResetCode).mockResolvedValue('alguem@exemplo.com');

    renderEm('?mode=resetPassword&oobCode=abc123');
    await screen.findByText('alguem@exemplo.com');

    fireEvent.change(screen.getByPlaceholderText(/mínimo 6 caracteres/i), { target: { value: 'senhanova1' } });
    fireEvent.change(screen.getByPlaceholderText(/repita a nova senha/i), { target: { value: 'outracoisa' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar nova senha/i }));

    expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument();
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  // Link de uso único: o segundo clique tem que explicar o que houve.
  it('explica quando o código já expirou', async () => {
    vi.mocked(verifyPasswordResetCode).mockRejectedValue({ code: 'auth/expired-action-code' });

    renderEm('?mode=resetPassword&oobCode=velho');

    expect(await screen.findByText(/este link expirou/i)).toBeInTheDocument();
  });

  it('confirma o e-mail no modo verifyEmail', async () => {
    vi.mocked(applyActionCode).mockResolvedValue(undefined);

    renderEm('?mode=verifyEmail&oobCode=abc123');

    expect(await screen.findByText('E-mail confirmado')).toBeInTheDocument();
    expect(applyActionCode).toHaveBeenCalledWith({}, 'abc123');
  });

  // O login por link de e-mail morreu junto com a página de recuperação de
  // ingresso — um link desses agora é tratado como não reconhecido.
  it('mostra erro para o modo signIn (fluxo aposentado)', async () => {
    renderEm('?mode=signIn&oobCode=abc123');

    expect(await screen.findByText('Este tipo de link não é reconhecido pelo app.')).toBeInTheDocument();
  });

  it('avisa quando o link vem sem os parâmetros', async () => {
    renderEm('');

    expect(await screen.findByText(/link incompleto/i)).toBeInTheDocument();
  });
});
