/**
 * Erro esperado (validação, regra de negócio) cuja mensagem pode ser mostrada
 * ao usuário. Qualquer outro erro é tratado como inesperado e vira uma
 * mensagem genérica — ver runAction em src/lib/action-result.ts.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}
