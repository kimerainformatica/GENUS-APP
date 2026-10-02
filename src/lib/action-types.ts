/**
 * Resultado de toda Server Action do app (ver runAction em action-result.ts).
 * Fica num arquivo próprio, sem dependências de servidor, para os componentes
 * do navegador poderem importar o tipo.
 */
export type ActionResult<T extends object = object> = ({ success: true } & T) | { success: false; error: string };

export const UNEXPECTED_ERROR = "Não foi possível concluir a operação. Tente novamente.";
