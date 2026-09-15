import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { serializar } = require('./backup-firestore');

const quando = { toDate: () => new Date('2026-09-14T12:00:00Z') };

describe('backup-firestore: serializar', () => {
  it('converte Timestamp, referência e GeoPoint em qualquer profundidade; o resto passa igual', () => {
    const doc = {
      nome: 'Kombi',
      n: 2,
      ok: true,
      nada: null,
      quando,
      lista: [quando, 'a', 1],
      dono: { path: 'profiles/abc', firestore: {} },
      onde: { latitude: -16.07, longitude: -57.68 },
      sub: { quando, tags: ['x'] },
    };
    expect(serializar(doc)).toEqual({
      nome: 'Kombi',
      n: 2,
      ok: true,
      nada: null,
      quando: '2026-09-14T12:00:00.000Z',
      lista: ['2026-09-14T12:00:00.000Z', 'a', 1],
      dono: { ref: 'profiles/abc' },
      onde: { lat: -16.07, lng: -57.68 },
      sub: { quando: '2026-09-14T12:00:00.000Z', tags: ['x'] },
    });
  });
});
