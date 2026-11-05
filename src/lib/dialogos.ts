import { useSyncExternalStore } from 'react';

// Pilha dos <dialog> modais abertos (components/ui/Modal). O Toaster se pendura no do
// topo: filho do diálogo é pintado junto com ele, acima do fundo escuro. Fora dele, a
// camada superior do navegador cobriria os toasts, qualquer que fosse o z-index.
let pilha: HTMLDialogElement[] = [];
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

/** Registra um diálogo aberto; devolve a função que o tira da pilha ao fechar. */
export function registrarDialogo(el: HTMLDialogElement): () => void {
  pilha = [...pilha, el];
  avisar();
  return () => {
    pilha = pilha.filter((d) => d !== el);
    avisar();
  };
}

const topo = () => pilha[pilha.length - 1] ?? null;
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
};

/** O diálogo modal aberto por último, ou null. */
export const useDialogoDoTopo = () => useSyncExternalStore(assinar, topo, () => null);
