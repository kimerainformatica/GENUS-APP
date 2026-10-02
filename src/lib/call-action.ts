import { UNEXPECTED_ERROR } from "@/lib/action-types";

// redirect() do Next dentro de uma Server Action (ex.: sessão expirada →
// /login) chega ao cliente como um erro com digest "NEXT_REDIRECT;...", que o
// próprio Next usa para navegar — não pode ser tratado como falha.
function isNextNavigationError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    (error.digest.startsWith("NEXT_REDIRECT") || error.digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  );
}

/**
 * Chama uma Server Action pelo navegador. As ações já devolvem
 * { success, error }; isto cobre só o imprevisto (ex.: o servidor interno do
 * app caiu), mostrando uma mensagem clara em vez de quebrar a tela.
 */
export async function callAction<T extends { success: boolean }>(action: () => Promise<T>): Promise<T | { success: false; error: string }> {
  try {
    return await action();
  } catch (error) {
    if (isNextNavigationError(error)) throw error;
    console.error("[action] falha ao chamar o servidor:", error);
    return { success: false, error: UNEXPECTED_ERROR };
  }
}
