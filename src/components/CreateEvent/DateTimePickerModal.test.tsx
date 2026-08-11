import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DateTimePickerModal } from './DateTimePickerModal';

// A grade do calendário foi reescrita de forma compacta (usa o overflow de Date para as
// bordas do mês). Estes testes existem para provar que ela continua produzindo as 42
// células certas e devolvendo a data no formato que o formulário espera.
describe('DateTimePickerModal', () => {
  const props = {
    open: true,
    date: '2026-08-11',
    time: '20:00',
    onConfirm: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => { vi.clearAllMocks(); });

  const grade = () => {
    // A grade é o container com as 42 células de dia (irmão dos cabeçalhos D/S/T/Q...).
    const celulas = screen.getAllByRole('button').filter(b => /^\d{1,2}$/.test(b.textContent || ''));
    return celulas;
  };

  it('não renderiza nada enquanto fechado', () => {
    const { container } = render(<DateTimePickerModal {...props} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('abre no mês da data recebida', () => {
    render(<DateTimePickerModal {...props} />);
    expect(screen.getByText('Agosto 2026')).toBeInTheDocument();
  });

  it('monta uma grade fixa de 42 células', () => {
    render(<DateTimePickerModal {...props} />);
    expect(grade()).toHaveLength(42);
  });

  it('devolve a data escolhida em YYYY-MM-DD e o horário', () => {
    render(<DateTimePickerModal {...props} />);
    // Agosto/2026 começa num sábado, então a 1ª célula do mês corrente é o dia 1.
    const dia20 = grade().find(b => b.textContent === '20' && !b.className.includes('text-textMuted/35'));
    fireEvent.click(dia20!);
    fireEvent.click(screen.getByText('Confirmar'));

    expect(props.onConfirm).toHaveBeenCalledWith('2026-08-20', '20:00');
  });

  it('navega entre meses sem pular (dezembro -> janeiro do ano seguinte)', () => {
    render(<DateTimePickerModal {...props} date="2026-12-05" />);
    expect(screen.getByText('Dezembro 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Próximo mês'));
    expect(screen.getByText('Janeiro 2027')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Mês anterior'));
    expect(screen.getByText('Dezembro 2026')).toBeInTheDocument();
  });

  it('o relógio dá a volta: 23h + 1 = 00h', () => {
    render(<DateTimePickerModal {...props} time="23:00" />);
    fireEvent.click(screen.getByLabelText('Aumentar hora'));
    fireEvent.click(screen.getByText('Confirmar'));

    expect(props.onConfirm).toHaveBeenCalledWith('2026-08-11', '00:00');
  });

  it('minutos andam de 5 em 5 e dão a volta', () => {
    render(<DateTimePickerModal {...props} time="20:55" />);
    fireEvent.click(screen.getByLabelText('Aumentar minuto'));
    fireEvent.click(screen.getByText('Confirmar'));

    expect(props.onConfirm).toHaveBeenCalledWith('2026-08-11', '20:00');
  });

  it('sem data preenchida, cai no mês atual em vez de quebrar', () => {
    render(<DateTimePickerModal {...props} date="" />);
    const agora = new Date();
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    expect(screen.getByText(`${meses[agora.getMonth()]} ${agora.getFullYear()}`)).toBeInTheDocument();
    expect(grade()).toHaveLength(42);
  });

  it('fecha pelo botão de fechar', () => {
    render(<DateTimePickerModal {...props} />);
    fireEvent.click(screen.getByLabelText('Fechar seletor de data'));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('o diálogo é acessível como modal', () => {
    render(<DateTimePickerModal {...props} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Data e horário')).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });
});
