import { collection, doc, onSnapshot, setDoc, updateDoc, arrayUnion, runTransaction, serverTimestamp } from 'firebase/firestore';
import type { DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { TAMANHO_GRUPO } from '../desafio';
import type { DesafioMesa } from '../desafio';

// Um documento por mesa (id = mesa). As rules garantem abertura, prazo, carência, vaga
// e que cada um só adiciona a si mesmo — aqui é só o transporte.
const ref = (mesa: string) => doc(db, 'desafios', mesa);

// Interruptor único do desafio. As rules leem ESTE documento para autorizar (ou não)
// início e entrada — a tela só o usa para explicar o que está acontecendo.
const refConfig = () => doc(db, 'config', 'desafio');

const ms = (t: unknown) => (t as Timestamp | null)?.toMillis?.() ?? null;

/** Inicia (ou reinicia, passada a carência) o desafio da mesa; quem chama vira o líder. */
export const iniciarDesafio = (mesa: string, uid: string) =>
  setDoc(ref(mesa), { mesa, liderId: uid, membros: [uid], iniciadoEm: serverTimestamp() });

/**
 * Entra no grupo; quem completa o 5º carimba liberadoEm (as rules exigem a hora do servidor).
 * Transação porque a contagem precisa ser a do servidor: com a do snapshot da tela, quem
 * entrava junto via o mesmo número, ninguém carimbava e as rules recusavam o 5º (a mesa
 * travava em 4 no teste de concorrência de 13/11). arrayUnion, e não a lista montada aqui:
 * uma lista velha é recusada pelas rules com permission-denied, que a transação não repete;
 * com arrayUnion a leitura velha vira erro de concorrência e a transação tenta de novo.
 */
export const entrarNoDesafio = (mesa: string, uid: string) =>
  runTransaction(db, async (tx) => {
    const membros: string[] = (await tx.get(ref(mesa))).data()?.membros ?? [];
    if (membros.includes(uid)) return;
    tx.update(ref(mesa), {
      membros: arrayUnion(uid),
      ...(membros.length + 1 >= TAMANHO_GRUPO ? { liberadoEm: serverTimestamp() } : {}),
    });
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

const paraMesa = (x: DocumentData): DesafioMesa => ({
  mesa: x.mesa,
  liderId: x.liderId,
  membros: x.membros || [],
  iniciadoEmMs: ms(x.iniciadoEm),
  liberadoEmMs: ms(x.liberadoEm),
  entregueEmMs: ms(x.entregueEm),
});

/** Escuta a mesa em tempo real (todas as telas do grupo veem o contador subir). */
export const ouvirDesafio = (mesa: string, cb: (d: DesafioMesa | null) => void) =>
  onSnapshot(ref(mesa), (snap) => cb(snap.exists() ? paraMesa(snap.data()) : null));

/**
 * Escuta TODAS as mesas (painel admin). A coleção é pequena — uma mesa por adesivo
 * impresso —, então não vale paginar.
 */
export const ouvirDesafios = (cb: (mesas: DesafioMesa[]) => void) =>
  onSnapshot(collection(db, 'desafios'), (snap) => cb(snap.docs.map((s) => paraMesa(s.data()))));

/** Admin entregou o refrigerante: queima o comprovante na tela dos cinco. */
export const marcarEntregue = (mesa: string) =>
  updateDoc(ref(mesa), { entregueEm: serverTimestamp() });

/** Desafio aberto? Vale deslogado (a tela precisa explicar antes de pedir login). */
export const ouvirAbertura = (cb: (aberto: boolean) => void) =>
  onSnapshot(refConfig(), (snap) => cb(snap.data()?.aberto === true));

/** Botão do painel: abre as mesas ou encerra o desafio (estoque acabou). */
export const definirAbertura = (aberto: boolean) =>
  setDoc(refConfig(), { aberto }, { merge: true });
