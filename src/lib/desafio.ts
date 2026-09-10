// Desafio da Kombi: um grupo de 5 pessoas por mesa dentro de 5 minutos ganha um
// refrigerante. Lógica PURA (sem Firebase) para ser testável; os dados vivem em
// storage/desafios.ts. Prazo e carência espelham as rules de `desafios/{mesa}` e são
// contados pelo relógio do SERVIDOR, nunca pelo do celular. A abertura das mesas é um
// interruptor do admin (`config/desafio.aberto`), lido aqui como parâmetro.

export const TAMANHO_GRUPO = 5;
export const PRAZO_MS = 5 * 60 * 1000;     // janela para juntar o grupo
export const CARENCIA_MS = 5 * 60 * 1000;  // espera após expirar antes de a mesa reabrir

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
 * - fechado:  o admin não abriu (ou já fechou) o desafio — nenhuma mesa joga
 * - livre:    ninguém jogando (ou a rodada anterior expirou e já cumpriu a carência)
 * - aberto:   grupo se formando, dentro do prazo
 * - liberado: fechou 5 — o comprovante NÃO caduca (a pessoa pode pegar fila na Kombi)
 *             e a mesa não reabre: um refrigerante por mesa é o estoque
 * - entregue: o admin já entregou; o comprovante vira canhoto
 * - expirado: prazo estourou sem 5; a carência esconde QUANDO reabre (decisão de produto)
 */
export function estadoDesafio(
  d: Pick<DesafioMesa, 'membros' | 'iniciadoEmMs' | 'entregueEmMs'> | null,
  agoraMs: number,
  aberto: boolean,
): EstadoDesafio {
  if (!aberto) return 'fechado';
  if (!d) return 'livre';
  if (d.entregueEmMs) return 'entregue';
  if (d.iniciadoEmMs === null) return 'aberto'; // acabou de iniciar, servidor ainda não carimbou
  // Mesa vencedora é queimada: `liberado` ganha da carência e não vira `livre` nunca.
  if (d.membros.length >= TAMANHO_GRUPO) return 'liberado';
  if (agoraMs < d.iniciadoEmMs + PRAZO_MS) return 'aberto';
  if (agoraMs >= d.iniciadoEmMs + PRAZO_MS + CARENCIA_MS) return 'livre';
  return 'expirado';
}

/** Milissegundos até o prazo estourar (nunca negativo). */
export const msRestantes = (iniciadoEmMs: number | null, agoraMs: number): number =>
  iniciadoEmMs === null ? PRAZO_MS : Math.max(0, iniciadoEmMs + PRAZO_MS - agoraMs);
