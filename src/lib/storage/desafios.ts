import { collection, doc, onSnapshot, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import type { DocumentData, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { TAMANHO_GRUPO } from '../desafio';
import type { DesafioMesa } from '../desafio';

// Um documento por mesa (id = mesa). As rules garantem abertura, prazo, carência, vaga,
// mesa queimada e que cada um só adiciona a si mesmo — aqui é só o transporte.
const ref = (mesa: string) => doc(db, 'desafios', mesa);

// Interruptor único do desafio. As rules leem ESTE documento para autorizar (ou não)
// início e entrada — a tela só o usa para explicar o que está acontecendo.
const refConfig = () => doc(db, 'config', 'desafio');

const ms = (t: unknown) => (t as Timestamp | null)?.toMillis?.() ?? null;

const paraMesa = (x: DocumentData): DesafioMesa => ({
  mesa: x.mesa,
  liderId: x.liderId,
  membros: x.membros || [],
  iniciadoEmMs: ms(x.iniciadoEm),
  liberadoEmMs: ms(x.liberadoEm),
  entregueEmMs: ms(x.entregueEm),
});

/** Inicia (ou reinicia, passada a carência) o desafio da mesa; quem chama vira o líder. */
export const iniciarDesafio = (mesa: string, uid: string) =>
  setDoc(ref(mesa), { mesa, liderId: uid, membros: [uid], iniciadoEm: serverTimestamp() });

/** Entra no grupo; quem completa o 5º carimba liberadoEm (as rules exigem a hora do servidor). */
export const entrarNoDesafio = (mesa: string, uid: string, membrosAtuais: number) =>
  updateDoc(ref(mesa), {
    membros: arrayUnion(uid),
    ...(membrosAtuais + 1 >= TAMANHO_GRUPO ? { liberadoEm: serverTimestamp() } : {}),
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
