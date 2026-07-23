import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventHeader } from './EventHeader';

describe('EventHeader Component', () => {
  const mockProps = {
    title: 'Show de Rock',
    mediaUrls: ['http://example.com/img1.jpg', 'http://example.com/img2.jpg'],
    currentMediaIndex: 0,
    onCurrentMediaIndexChange: vi.fn(),
    onBack: vi.fn(),
    onShare: vi.fn(),
  };

  it('renders event title and media indicators', () => {
    render(<EventHeader {...mockProps} />);
    expect(screen.getByText('Show de Rock')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    render(<EventHeader {...mockProps} />);
    const backBtn = screen.getByLabelText('Voltar');
    fireEvent.click(backBtn);
    expect(mockProps.onBack).toHaveBeenCalled();
  });

  it('calls onShare when share button is clicked', () => {
    render(<EventHeader {...mockProps} />);
    const shareBtn = screen.getByLabelText('Compartilhar');
    fireEvent.click(shareBtn);
    expect(mockProps.onShare).toHaveBeenCalled();
  });
});
