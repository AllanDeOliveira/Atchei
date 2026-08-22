import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CookieBanner } from './CookieBanner';
import { COOKIE_CONSENT_KEY, aplicarConsentimento } from '../lib/firebase';
import { INSTALL_DISMISS_KEY } from '../lib/storageKeys';
import { INSTALL_RESOLVED_EVENT } from '../hooks/useInstallCardPending';

vi.mock('../lib/firebase', () => ({
  COOKIE_CONSENT_KEY: 'atchei:cookie-consent',
  aplicarConsentimento: vi.fn(),
}));

describe('CookieBanner Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // O banner só aparece depois que o convite de instalação sai da tela. Os testes
    // abaixo tratam do banner em si, então partem do convite já dispensado.
    localStorage.setItem(INSTALL_DISMISS_KEY, '1');
  });

  // O aviso não depende de login: quem chega por link de evento (a maior parte do
  // público) também precisa poder escolher — e é dele que vêm as métricas.
  it('renders banner for anonymous visitors', () => {
    render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>
    );

    expect(screen.getByText('Primeiro, vamos falar dos cookies 🍪')).toBeInTheDocument();
  });

  it('renders cookie banner for logged in user when no consent is stored', () => {
    render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>
    );

    expect(screen.getByText('Primeiro, vamos falar dos cookies 🍪')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aceitar todos os cookies/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /administrar cookies/i })).toBeInTheDocument();
  });

  it('does not render banner if user has already made a choice', () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'all');

    render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>
    );

    expect(screen.queryByText('Primeiro, vamos falar dos cookies 🍪')).not.toBeInTheDocument();
  });

  it('accepts all cookies on primary button click', () => {
    render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>
    );

    const acceptBtn = screen.getByRole('button', { name: /aceitar todos os cookies/i });
    fireEvent.click(acceptBtn);

    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('all');
    expect(aplicarConsentimento).toHaveBeenCalledWith(true);
    expect(screen.queryByText('Primeiro, vamos falar dos cookies 🍪')).not.toBeInTheDocument();
  });

  it('opens preferences modal when clicking "Administrar cookies"', () => {
    render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>
    );

    const adminBtn = screen.getByRole('button', { name: /administrar cookies/i });
    fireEvent.click(adminBtn);

    expect(screen.getByText('Preferências de cookies')).toBeInTheDocument();
    expect(screen.getByText('Cookies essenciais')).toBeInTheDocument();
    expect(screen.getByText('Cookies analíticos (GA4)')).toBeInTheDocument();
  });

  it('saves "essential" when clicking "Apenas essenciais" in modal', () => {
    render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /administrar cookies/i }));

    const essentialBtn = screen.getByRole('button', { name: /apenas essenciais/i });
    fireEvent.click(essentialBtn);

    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('essential');
    expect(aplicarConsentimento).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('toggles analytics and saves preferences accordingly', () => {
    render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /administrar cookies/i }));

    const analyticsCheckbox = screen.getByRole('checkbox', { name: /permitir cookies analíticos/i });
    expect(analyticsCheckbox).toBeChecked();

    // Desmarca analytics
    fireEvent.click(analyticsCheckbox);
    expect(analyticsCheckbox).not.toBeChecked();

    // Salva preferências
    fireEvent.click(screen.getByRole('button', { name: /salvar preferências/i }));

    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toBe('essential');
    expect(aplicarConsentimento).toHaveBeenCalledWith(false);
  });

  it('opens preferences modal when "atchei:open-cookie-preferences" event is dispatched', () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'all');

    render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new CustomEvent('atchei:open-cookie-preferences'));
    });

    expect(screen.getByText('Preferências de cookies')).toBeInTheDocument();
  });

  // A ordem pedida: "adicionar à tela inicial" primeiro, cookies depois.
  it('só mostra o banner depois que o convite de instalação sai da tela', () => {
    localStorage.removeItem(INSTALL_DISMISS_KEY);

    render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>
    );

    expect(screen.queryByText('Primeiro, vamos falar dos cookies 🍪')).not.toBeInTheDocument();

    act(() => {
      localStorage.setItem(INSTALL_DISMISS_KEY, '1');
      window.dispatchEvent(new Event(INSTALL_RESOLVED_EVENT));
    });

    expect(screen.getByText('Primeiro, vamos falar dos cookies 🍪')).toBeInTheDocument();
  });

  // O link do rodapé precisa funcionar mesmo antes de o convite ser resolvido.
  it('abre as preferências pelo rodapé mesmo com o convite de instalação na tela', () => {
    localStorage.removeItem(INSTALL_DISMISS_KEY);

    render(
      <MemoryRouter>
        <CookieBanner />
      </MemoryRouter>
    );

    act(() => {
      window.dispatchEvent(new CustomEvent('atchei:open-cookie-preferences'));
    });

    expect(screen.getByText('Preferências de cookies')).toBeInTheDocument();
  });
});
