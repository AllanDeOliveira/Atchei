import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InstallAppCard, DISMISS_KEY } from './InstallAppCard';
import { INSTALL_RESOLVED_EVENT } from '../hooks/useInstallCardPending';
import { COOKIE_CONSENT_KEY } from '../lib/firebase';

vi.mock('../lib/firebase', () => ({
  COOKIE_CONSENT_KEY: 'atchei:cookie-consent',
}));

const setUserAgent = (ua: string) =>
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';

describe('InstallAppCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
    setUserAgent(IOS_UA);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderComConsentimento = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'all');
    render(<InstallAppCard />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
  };

  it('renders install prompt 2s after cookie consent already given', () => {
    renderComConsentimento();

    expect(screen.getByText('Adicione o Atchei à tela inicial')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /como instalar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agora não/i })).toBeInTheDocument();
  });

  it('waits for cookie decision event, then appears after 2s', () => {
    render(<InstallAppCard />);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('Adicione o Atchei à tela inicial')).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event('atchei:cookies-decididos'));
      vi.advanceTimersByTime(1999);
    });
    expect(screen.queryByText('Adicione o Atchei à tela inicial')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('Adicione o Atchei à tela inicial')).toBeInTheDocument();
  });

  it('does not render on desktop browsers', () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36');
    renderComConsentimento();

    expect(screen.queryByText('Adicione o Atchei à tela inicial')).not.toBeInTheDocument();
  });

  it('does not render if previously dismissed', () => {
    localStorage.setItem(DISMISS_KEY, '1');
    renderComConsentimento();

    expect(screen.queryByText('Adicione o Atchei à tela inicial')).not.toBeInTheDocument();
  });

  it('dismisses card when "Agora não" button is clicked', () => {
    renderComConsentimento();

    const agoraNaoBtn = screen.getByRole('button', { name: /agora não/i });
    fireEvent.click(agoraNaoBtn);

    expect(localStorage.getItem(DISMISS_KEY)).toBe('1');
    expect(screen.queryByText('Adicione o Atchei à tela inicial')).not.toBeInTheDocument();
  });

  // É esse evento que passa a vez para o aviso de cookies.
  it('avisa que o convite foi resolvido ao dispensar', () => {
    const ouvinte = vi.fn();
    window.addEventListener(INSTALL_RESOLVED_EVENT, ouvinte);

    renderComConsentimento();
    fireEvent.click(screen.getByRole('button', { name: /agora não/i }));

    expect(ouvinte).toHaveBeenCalledTimes(1);
    window.removeEventListener(INSTALL_RESOLVED_EVENT, ouvinte);
  });

  it('opens guide modal when "Como instalar" is clicked without native prompt event', () => {
    renderComConsentimento();

    const installBtn = screen.getByRole('button', { name: /como instalar/i });
    fireEvent.click(installBtn);

    expect(screen.getByText('Como instalar o Atchei')).toBeInTheDocument();
    expect(screen.getByText(/No Google Chrome \/ Android:/i)).toBeInTheDocument();
    expect(screen.getByText(/No Safari \/ iPhone \(iOS\):/i)).toBeInTheDocument();

    const entendidoBtn = screen.getByRole('button', { name: /entendido/i });
    fireEvent.click(entendidoBtn);

    expect(screen.queryByText('Como instalar o Atchei')).not.toBeInTheDocument();
  });
});
