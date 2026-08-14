import { describe, it, expect, vi } from 'vitest';
const { getTomorrowDateString, processarLembretesD1 } = require('./reminders');

describe('Reminders D-1 Module', () => {
    it('calcula corretamente a data de amanhã YYYY-MM-DD', () => {
        // Base: 2026-08-14
        const baseDate = new Date('2026-08-14T12:00:00Z');
        const tomorrow = getTomorrowDateString(baseDate, 'UTC');
        expect(tomorrow).toBe('2026-08-15');
    });

    it('processarLembretesD1 envia notificações sem duplicação por usuário', async () => {
        const mockEvents = [
            {
                id: 'evt-1',
                data: () => ({
                    title: 'Calourada 2026',
                    date: '2026-08-15',
                    time: '23:00',
                    location: 'Arena Central',
                    isTestEvent: false
                })
            }
        ];

        const mockRegistrations = [
            {
                id: 'reg-1',
                data: () => ({
                    userId: 'user-123',
                    isTeste: false
                })
            },
            {
                // Mesmo usuário com segundo ingresso (não deve receber push duplicado)
                id: 'reg-2',
                data: () => ({
                    userId: 'user-123',
                    isTeste: false
                })
            },
            {
                id: 'reg-3',
                data: () => ({
                    userId: 'user-456',
                    isTeste: false
                })
            },
            {
                // Inscrição de teste ignorada
                id: 'reg-4',
                data: () => ({
                    userId: 'user-789',
                    isTeste: true
                })
            }
        ];

        const db = {
            collection: vi.fn((colName) => {
                if (colName === 'events') {
                    return {
                        where: vi.fn().mockReturnValue({
                            get: vi.fn().mockResolvedValue({
                                empty: false,
                                docs: mockEvents
                            })
                        })
                    };
                }
                if (colName === 'registrations') {
                    return {
                        where: vi.fn().mockReturnValue({
                            get: vi.fn().mockResolvedValue({
                                empty: false,
                                docs: mockRegistrations
                            })
                        })
                    };
                }
                return {};
            })
        };

        const mockEnviarPush = vi.fn().mockResolvedValue(true);

        const result = await processarLembretesD1(db, '2026-08-15', mockEnviarPush);

        expect(result.totalEventos).toBe(1);
        expect(result.totalNotificacoes).toBe(2); // user-123 e user-456
        expect(mockEnviarPush).toHaveBeenCalledTimes(2);
        expect(mockEnviarPush).toHaveBeenCalledWith(
            'user-123',
            'Seu evento é amanhã! ⏰',
            expect.stringContaining('Calourada 2026'),
            '/event/evt-1'
        );
        expect(mockEnviarPush).toHaveBeenCalledWith(
            'user-456',
            'Seu evento é amanhã! ⏰',
            expect.stringContaining('Calourada 2026'),
            '/event/evt-1'
        );
    });

    it('ignora eventos de teste no lembrete D-1', async () => {
        const mockEvents = [
            {
                id: 'evt-teste',
                data: () => ({
                    title: 'Evento Teste',
                    date: '2026-08-15',
                    isTestEvent: true
                })
            }
        ];

        const db = {
            collection: vi.fn(() => ({
                where: vi.fn().mockReturnValue({
                    get: vi.fn().mockResolvedValue({
                        empty: false,
                        docs: mockEvents
                    })
                })
            }))
        };

        const mockEnviarPush = vi.fn();
        const result = await processarLembretesD1(db, '2026-08-15', mockEnviarPush);

        expect(result.totalEventos).toBe(0);
        expect(result.totalNotificacoes).toBe(0);
        expect(mockEnviarPush).not.toHaveBeenCalled();
    });
});
