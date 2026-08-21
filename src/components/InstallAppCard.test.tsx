import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstallAppCard, DISMISS_KEY } from './InstallAppCard';

describe('InstallAppCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders install prompt on first visit when not dismissed', () => {
    render(<InstallAppCard />);

    expect(screen.getByText('Adicione o Atchei à tela inicial')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /instalar app/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agora não/i })).toBeInTheDocument();
  });

  it('does not render if previously dismissed', () => {
    localStorage.setItem(DISMISS_KEY, '1');

    render(<InstallAppCard />);

    expect(screen.queryByText('Adicione o Atchei à tela inicial')).not.toBeInTheDocument();
  });

  it('dismisses card when "Agora não" button is clicked', () => {
    render(<InstallAppCard />);

    const agoraNaoBtn = screen.getByRole('button', { name: /agora não/i });
    fireEvent.click(agoraNaoBtn);

    expect(localStorage.getItem(DISMISS_KEY)).toBe('1');
    expect(screen.queryByText('Adicione o Atchei à tela inicial')).not.toBeInTheDocument();
  });

  it('opens guide modal when "Instalar app" is clicked without native prompt event', () => {
    render(<InstallAppCard />);

    const installBtn = screen.getByRole('button', { name: /instalar app/i });
    fireEvent.click(installBtn);

    expect(screen.getByText('Como instalar o Atchei')).toBeInTheDocument();
    expect(screen.getByText(/No Google Chrome \/ Android:/i)).toBeInTheDocument();
    expect(screen.getByText(/No Safari \/ iPhone \(iOS\):/i)).toBeInTheDocument();

    const entendidoBtn = screen.getByRole('button', { name: /entendido/i });
    fireEvent.click(entendidoBtn);

    expect(screen.queryByText('Como instalar o Atchei')).not.toBeInTheDocument();
  });
});
