import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import type { Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { TAMANHO_GRUPO } from '../desafio';
import type { DesafioMesa } from '../desafio';

// Um documento por mesa (id = mesa). As rules garantem prazo, carência, vaga
// e que cada um só adiciona a si mesmo — aqui é só o transporte.
const ref = (mesa: string) => doc(db, 'desafios', mesa);

/** Inicia (ou reinicia, passada a carência) o desafio da mesa; quem chama vira o líder. */
export const iniciarDesafio = (mesa: string, uid: string) =>
  setDoc(ref(mesa), { mesa, liderId: uid, membros: [uid], iniciadoEm: serverTimestamp() });

/** Entra no grupo; quem completa o 5º carimba liberadoEm (as rules exigem a hora do servidor). */
export const entrarNoDesafio = (mesa: string, uid: string, membrosAtuais: number) =>
  updateDoc(ref(mesa), {
    membros: arrayUnion(uid),
    ...(membrosAtuais + 1 >= TAMANHO_GRUPO ? { liberadoEm: serverTimestamp() } : {}),
  });

/**
 * Quem já ganhou (carimbado pela function quando a mesa fecha 5) não joga de novo —
 * as rules recusam; aqui só lemos o próprio carimbo para mostrar a tela certa.
 */
export const ouvirGanhador = (uid: string, cb: (g: { mesa: string; ganhouEmMs: number | null } | null) => void) =>
  onSnapshot(doc(db, 'desafioGanhadores', uid), (snap) => {
    if (!snap.exists()) return cb(null);
    const x = snap.data();
    cb({ mesa: x.mesa, ganhouEmMs: (x.ganhouEm as Timestamp | null)?.toMillis() ?? null });
  });

/** Escuta a mesa em tempo real (todas as telas do grupo veem o contador subir). */
export const ouvirDesafio = (mesa: string, cb: (d: DesafioMesa | null) => void) =>
  onSnapshot(ref(mesa), (snap) => {
    if (!snap.exists()) return cb(null);
    const x = snap.data();
    cb({
      mesa: x.mesa,
      liderId: x.liderId,
      membros: x.membros || [],
      iniciadoEmMs: (x.iniciadoEm as Timestamp | null)?.toMillis() ?? null,
      liberadoEmMs: (x.liberadoEm as Timestamp | null)?.toMillis() ?? null,
    });
  });
