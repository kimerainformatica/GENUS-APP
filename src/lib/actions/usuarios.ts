"use server";

import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";
import { deleteUserSessions, requireSession } from "@/lib/auth/session";
import { cleanText, passwordError } from "@/lib/auth/validation";
import { prisma } from "@/lib/prisma";
import { optionalIdField } from "@/lib/validation";

export type UsuarioActionResult = { success: true } | { success: false; error: string };

type Guard = { ok: true; adminId: string; targetId: string } | { ok: false; error: string };

/** Só admins; e um admin não altera a própria conta por aqui (usa "Minha conta"). */
async function guardAdminTarget(rawId: string): Promise<Guard> {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") return { ok: false, error: "Sem permissão." };
  const targetId = optionalIdField(rawId);
  if (!targetId) return { ok: false, error: "Usuário inválido." };
  if (targetId === session.user.id) return { ok: false, error: "Para alterar a sua própria conta, use \"Minha conta\"." };
  return { ok: true, adminId: session.user.id, targetId };
}

function revalidateUsuarios() {
  revalidatePath("/admin/usuarios");
}

/** Define uma senha temporária: o usuário é obrigado a criar a própria no próximo acesso. */
export async function redefinirSenhaUsuario(usuarioId: string, formData: FormData): Promise<UsuarioActionResult> {
  const guard = await guardAdminTarget(usuarioId);
  if (!guard.ok) return { success: false, error: guard.error };
  const senha = cleanText(formData.get("senhaTemporaria"), 128);
  const confirmacao = cleanText(formData.get("confirmacao"), 128);
  const senhaInvalida = passwordError(senha);
  if (senhaInvalida) return { success: false, error: senhaInvalida };
  if (senha !== confirmacao) return { success: false, error: "A confirmação não confere com a senha temporária." };

  const existe = await prisma.usuario.findUnique({ where: { id: guard.targetId }, select: { id: true } });
  if (!existe) return { success: false, error: "Usuário não encontrado." };
  await prisma.usuario.update({
    where: { id: guard.targetId },
    data: { senhaHash: await bcrypt.hash(senha, 12), trocarSenha: true },
  });
  await deleteUserSessions(guard.targetId);
  revalidateUsuarios();
  return { success: true };
}

/** Nunca deixa o app sem nenhum administrador ativo. */
async function seriaUltimoAdminAtivo(targetId: string): Promise<boolean> {
  const outros = await prisma.usuario.count({ where: { role: "ADMIN", ativo: true, id: { not: targetId } } });
  return outros === 0;
}

export async function alterarCargoUsuario(usuarioId: string, role: string): Promise<UsuarioActionResult> {
  const guard = await guardAdminTarget(usuarioId);
  if (!guard.ok) return { success: false, error: guard.error };
  if (role !== "ADMIN" && role !== "USER") return { success: false, error: "Cargo inválido." };

  const alvo = await prisma.usuario.findUnique({ where: { id: guard.targetId }, select: { role: true, ativo: true } });
  if (!alvo) return { success: false, error: "Usuário não encontrado." };
  if (alvo.role === role) return { success: true };
  if (role === "USER" && alvo.ativo && (await seriaUltimoAdminAtivo(guard.targetId))) {
    return { success: false, error: "Este é o único administrador ativo. Promova outro usuário antes." };
  }

  await prisma.usuario.update({
    where: { id: guard.targetId },
    // Código de recuperação é só de administrador: quem deixa de ser admin perde o código.
    data: role === "USER" ? { role, codigoRecuperacaoHash: null, codigoRecuperacaoEm: null } : { role },
  });
  // O cargo é lido do banco a cada requisição (getSession), então já vale sem novo login.
  revalidateUsuarios();
  return { success: true };
}

export async function alterarStatusUsuario(usuarioId: string, ativo: boolean): Promise<UsuarioActionResult> {
  const guard = await guardAdminTarget(usuarioId);
  if (!guard.ok) return { success: false, error: guard.error };

  const alvo = await prisma.usuario.findUnique({ where: { id: guard.targetId }, select: { role: true, ativo: true } });
  if (!alvo) return { success: false, error: "Usuário não encontrado." };
  if (alvo.ativo === ativo) return { success: true };
  if (!ativo && alvo.role === "ADMIN" && (await seriaUltimoAdminAtivo(guard.targetId))) {
    return { success: false, error: "Este é o único administrador ativo e não pode ser desativado." };
  }

  await prisma.usuario.update({ where: { id: guard.targetId }, data: { ativo } });
  if (!ativo) await deleteUserSessions(guard.targetId);
  revalidateUsuarios();
  return { success: true };
}
