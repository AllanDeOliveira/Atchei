import { describe, it, expect } from 'vitest';
import { EVENTO_VAZIO, validarEvento } from './eventoForm';

const valido = {
  ...EVENTO_VAZIO,
  title: 'Sunset Party',
  date: '2026-10-25',
  time: '22:00',
  address: 'Rua X, 123',
  description: 'Descrição com mais de dez caracteres',
};

describe('validarEvento', () => {
  it('evento preenchido passa', () => {
    expect(validarEvento(valido)).toEqual([]);
  });

  it('evento vazio acusa cada campo obrigatório, na ordem', () => {
    expect(validarEvento(EVENTO_VAZIO)).toEqual([
      'Mínimo 3 caracteres',
      'Data obrigatória',
      'Horário obrigatório',
      'Endereço obrigatório',
      'A descrição deve ter no mínimo 10 caracteres',
    ]);
  });

  it('limite de participantes: vazio passa, zero e texto não', () => {
    expect(validarEvento({ ...valido, maxParticipants: '' })).toEqual([]);
    expect(validarEvento({ ...valido, maxParticipants: '50' })).toEqual([]);
    expect(validarEvento({ ...valido, maxParticipants: '0' })).toHaveLength(1);
    expect(validarEvento({ ...valido, maxParticipants: 'dez' })).toHaveLength(1);
  });

  it('ingressos exigem o WhatsApp do primeiro promoter com 10+ dígitos', () => {
    expect(validarEvento({ ...valido, hasTickets: true })).toEqual(['WhatsApp obrigatório para vendas (mín. 10 digitos)']);
    expect(validarEvento({ ...valido, hasTickets: true, whatsappContacts: [{ name: 'Ana', phone: '(65) 99999-1234' }] })).toEqual([]);
    expect(validarEvento({ ...valido, hasTickets: false, whatsappContacts: [] })).toEqual([]);
  });
});
