"use server";

import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action-result";
import { deleteUserSessions, requireSession } from "@/lib/auth/session";
import { cleanText, passwordError } from "@/lib/auth/validation";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/user-facing-error";
import { optionalIdField } from "@/lib/validation";

/** Só admins; e um admin não altera a própria conta por aqui (usa "Minha conta"). Devolve o id do usuário-alvo. */
async function guardAdminTarget(rawId: string): Promise<string> {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") throw new UserFacingError("Sem permissão.");
  const targetId = optionalIdField(rawId);
  if (!targetId) throw new UserFacingError("Usuário inválido.");
  if (targetId === session.user.id) throw new UserFacingError("Para alterar a sua própria conta, use \"Minha conta\".");
  return targetId;
}

async function findTarget(targetId: string) {
  const alvo = await prisma.usuario.findUnique({ where: { id: targetId }, select: { role: true, ativo: true } });
  if (!alvo) throw new UserFacingError("Usuário não encontrado.");
  return alvo;
}

/** Nunca deixa o app sem nenhum administrador ativo. */
async function seriaUltimoAdminAtivo(targetId: string): Promise<boolean> {
  const outros = await prisma.usuario.count({ where: { role: "ADMIN", ativo: true, id: { not: targetId } } });
  return outros === 0;
}

/** Define uma senha temporária: o usuário é obrigado a criar a própria no próximo acesso. */
export async function redefinirSenhaUsuario(usuarioId: string, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const targetId = await guardAdminTarget(usuarioId);
    const senha = cleanText(formData.get("senhaTemporaria"), 128);
    const confirmacao = cleanText(formData.get("confirmacao"), 128);
    const senhaInvalida = passwordError(senha);
    if (senhaInvalida) throw new UserFacingError(senhaInvalida);
    if (senha !== confirmacao) throw new UserFacingError("A confirmação não confere com a senha temporária.");

    await findTarget(targetId);
    await prisma.usuario.update({
      where: { id: targetId },
      data: { senhaHash: await bcrypt.hash(senha, 12), trocarSenha: true },
    });
    await deleteUserSessions(targetId);
    revalidatePath("/admin/usuarios");
    return {};
  });
}

export async function alterarCargoUsuario(usuarioId: string, role: string): Promise<ActionResult> {
  return runAction(async () => {
    const targetId = await guardAdminTarget(usuarioId);
    if (role !== "ADMIN" && role !== "USER") throw new UserFacingError("Cargo inválido.");

    const alvo = await findTarget(targetId);
    if (alvo.role === role) return {};
    if (role === "USER" && alvo.ativo && (await seriaUltimoAdminAtivo(targetId))) {
      throw new UserFacingError("Este é o único administrador ativo. Promova outro usuário antes.");
    }

    await prisma.usuario.update({
      where: { id: targetId },
      // Código de recuperação é só de administrador: quem deixa de ser admin perde o código.
      data: role === "USER" ? { role, codigoRecuperacaoHash: null, codigoRecuperacaoEm: null } : { role },
    });
    // O cargo é lido do banco a cada requisição (getSession), então já vale sem novo login.
    revalidatePath("/admin/usuarios");
    return {};
  });
}

export async function alterarStatusUsuario(usuarioId: string, ativo: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const targetId = await guardAdminTarget(usuarioId);
    const alvo = await findTarget(targetId);
    if (alvo.ativo === ativo) return {};
    if (!ativo && alvo.role === "ADMIN" && (await seriaUltimoAdminAtivo(targetId))) {
      throw new UserFacingError("Este é o único administrador ativo e não pode ser desativado.");
    }

    await prisma.usuario.update({ where: { id: targetId }, data: { ativo } });
    if (!ativo) await deleteUserSessions(targetId);
    revalidatePath("/admin/usuarios");
    return {};
  });
}
