import "server-only";

import { unstable_rethrow } from "next/navigation";
import { UNEXPECTED_ERROR, type ActionResult } from "@/lib/action-types";
import { UserFacingError } from "@/lib/user-facing-error";

// Server Actions NUNCA lançam erro para o cliente: no build de produção o
// Next.js esconde a mensagem de qualquer erro lançado por uma Server Action
// (o usuário via "Minified React error #441" em vez de "CPF/CNPJ inválido").
export { UNEXPECTED_ERROR, type ActionResult };

/**
 * Executa o corpo de uma Server Action e converte erros em resultado:
 * UserFacingError → mensagem real; qualquer outro → mensagem genérica (o
 * detalhe vai só para o log, para não expor dados internos na tela).
 * redirect()/notFound() do Next (ex.: sessão expirada → /login) continuam
 * funcionando: unstable_rethrow os repassa.
 */
export async function runAction<T extends object>(body: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { success: true, ...(await body()) };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof UserFacingError) return { success: false, error: error.message };
    console.error("[action] erro inesperado:", error);
    return { success: false, error: UNEXPECTED_ERROR };
  }
}
