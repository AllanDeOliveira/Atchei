import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventLocationMap } from './EventLocationMap';

describe('EventLocationMap Component', () => {
  const mockProps = {
    location: 'Parque Central',
    address: 'Av. Paulista, 1000',
  };

  it('renders location name and address', () => {
    render(<EventLocationMap {...mockProps} />);
    expect(screen.getByText('Parque Central')).toBeInTheDocument();
    expect(screen.getByText('Av. Paulista, 1000')).toBeInTheDocument();
  });

  it('opens Google Maps in new window when route button is clicked', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<EventLocationMap {...mockProps} />);
    
    const routeBtn = screen.getByText(/Ver rota no Google Maps/i);
    fireEvent.click(routeBtn);

    expect(windowOpenSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://www.google.com/maps/dir/?api=1&destination=Av.%20Paulista%2C%201000'),
      '_blank'
    );
    windowOpenSpy.mockRestore();
  });
});
