import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { NavigateFunction } from "react-router-dom";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Volta no histórico do app; sem histórico (acesso direto por link, refresh, PWA),
 * navigate(-1) seria um no-op — então vai para o destino padrão.
 * O idx é mantido pelo react-router: 0 = primeira entrada desta sessão.
 */
export function goBack(navigate: NavigateFunction, fallback: string = "/") {
  if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
  else navigate(fallback);
}

/** Destino pós-login vindo de `?next=` — só caminhos internos (evita open redirect). */
export function nextSeguro(search: string, fallback: string = "/feed"): string {
  const next = new URLSearchParams(search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}
