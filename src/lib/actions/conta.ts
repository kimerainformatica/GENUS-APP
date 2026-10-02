"use server";

import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action-result";
import { generateRecoveryCode, hashRecoveryCode } from "@/lib/auth/recovery-code";
import { deleteUserSessions, requireSession } from "@/lib/auth/session";
import { cleanText, passwordError } from "@/lib/auth/validation";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/user-facing-error";

export type ContaResult = ActionResult<{ codigoRecuperacao?: string }>;

async function senhaAtualConfere(usuarioId: string, senha: string): Promise<boolean> {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId }, select: { senhaHash: true } });
  return usuario ? bcrypt.compare(senha, usuario.senhaHash) : false;
}

/**
 * Troca a senha do próprio usuário. Também é a ação da tela obrigatória
 * /trocar-senha (senha temporária definida por um admin), por isso aceita
 * sessão com troca pendente. Encerra as outras sessões do usuário.
 */
export async function alterarMinhaSenha(formData: FormData): Promise<ContaResult> {
  return runAction(async () => {
    const session = await requireSession({ allowPendingPasswordChange: true });
    const senhaAtual = cleanText(formData.get("senhaAtual"), 128);
    const novaSenha = cleanText(formData.get("novaSenha"), 128);
    const confirmacao = cleanText(formData.get("confirmacao"), 128);

    if (!senhaAtual) throw new UserFacingError("Informe a senha atual.");
    const senhaInvalida = passwordError(novaSenha);
    if (senhaInvalida) throw new UserFacingError(senhaInvalida);
    if (novaSenha !== confirmacao) throw new UserFacingError("A confirmação não confere com a nova senha.");
    if (novaSenha === senhaAtual) throw new UserFacingError("A nova senha precisa ser diferente da atual.");
    if (!(await senhaAtualConfere(session.user.id, senhaAtual))) throw new UserFacingError("Senha atual incorreta.");

    await prisma.usuario.update({
      where: { id: session.user.id },
      data: { senhaHash: await bcrypt.hash(novaSenha, 12), trocarSenha: false },
    });
    await deleteUserSessions(session.user.id, session.sessionId);
    revalidatePath("/", "layout");
    return {};
  });
}

/** Só administradores: gera um código de recuperação novo (o anterior deixa de valer). */
export async function gerarCodigoRecuperacao(formData: FormData): Promise<ContaResult> {
  return runAction(async () => {
    const session = await requireSession();
    if (session.user.role !== "ADMIN") throw new UserFacingError("Só administradores têm código de recuperação.");
    const senhaAtual = cleanText(formData.get("senhaAtual"), 128);
    if (!senhaAtual || !(await senhaAtualConfere(session.user.id, senhaAtual))) {
      throw new UserFacingError("Senha atual incorreta.");
    }

    const codigoRecuperacao = generateRecoveryCode();
    await prisma.usuario.update({
      where: { id: session.user.id },
      data: { codigoRecuperacaoHash: await hashRecoveryCode(codigoRecuperacao), codigoRecuperacaoEm: new Date() },
    });
    revalidatePath("/", "layout");
    return { codigoRecuperacao };
  });
}
