// Desafio da Kombi: um grupo de 5 pessoas por mesa dentro de 5 minutos ganha um
// refrigerante. Lógica PURA (sem Firebase) para ser testável; os dados vivem em
// storage/desafios.ts. Prazo e carência espelham as rules de `desafios/{mesa}`:
// tudo é contado pelo relógio do SERVIDOR a partir de iniciadoEm. A abertura das
// mesas é um interruptor do admin (`config/desafio.aberto`), lido aqui como parâmetro.

export const TAMANHO_GRUPO = 5;
export const PRAZO_MS = 3 * 60 * 1000;     // janela para juntar o grupo (5 min era folgado demais no teste real)
export const CARENCIA_MS = 5 * 60 * 1000;  // espera após expirar/liberar antes de a mesa reabrir

export interface DesafioMesa {
  mesa: string;
  liderId: string;
  membros: string[];
  /** null enquanto o serverTimestamp ainda não confirmou (latência local). */
  iniciadoEmMs: number | null;
  liberadoEmMs: number | null;
  /** carimbo do admin na entrega do refrigerante; queima o comprovante. */
  entregueEmMs: number | null;
}

export type EstadoDesafio = 'fechado' | 'livre' | 'aberto' | 'liberado' | 'entregue' | 'expirado';

/**
 * Estado da mesa num instante:
 * - fechado:  o admin não abriu (ou já encerrou) o desafio — ninguém começa
 * - livre:    ninguém jogando (ou a rodada anterior falhou e já cumpriu prazo + carência)
 * - aberto:   grupo se formando, dentro do prazo
 * - liberado: fechou 5 — a mesa fica "queimada" para sempre (1 prêmio por mesa = estoque).
 *             Vale mesmo se o admin encerrar o desafio depois: quem ganhou não perde
 * - entregue: o refrigerante saiu; o comprovante vira canhoto
 * - expirado: prazo estourou sem 5; a carência esconde QUANDO reabre (decisão de produto)
 */
export function estadoDesafio(
  d: Pick<DesafioMesa, 'membros' | 'iniciadoEmMs' | 'entregueEmMs'> | null,
  agoraMs: number,
  aberto: boolean,
): EstadoDesafio {
  if (!d) return aberto ? 'livre' : 'fechado';
  if (d.entregueEmMs) return 'entregue';
  // Ganhou antes de encerrar: o comprovante continua valendo.
  if (d.membros.length >= TAMANHO_GRUPO) return 'liberado';
  if (!aberto) return 'fechado';
  if (d.iniciadoEmMs === null) return 'aberto'; // acabou de iniciar, servidor ainda não carimbou
  if (agoraMs >= d.iniciadoEmMs + PRAZO_MS + CARENCIA_MS) return 'livre';
  if (agoraMs < d.iniciadoEmMs + PRAZO_MS) return 'aberto';
  return 'expirado';
}

/** Milissegundos até o prazo estourar (nunca negativo). */
export const msRestantes = (iniciadoEmMs: number | null, agoraMs: number): number =>
  iniciadoEmMs === null ? PRAZO_MS : Math.max(0, iniciadoEmMs + PRAZO_MS - agoraMs);
