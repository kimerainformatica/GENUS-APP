"use server";

import bcrypt from "bcrypt";
import { redirect } from "next/navigation";
import { runAction, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { generateRecoveryCode, hashRecoveryCode, verifyRecoveryCode } from "@/lib/auth/recovery-code";
import { createSession, deleteCurrentSession, deleteUserSessions } from "@/lib/auth/session";
import { cleanText, normalizeEmail, passwordError, validEmail } from "@/lib/auth/validation";
import { UserFacingError } from "@/lib/user-facing-error";

/** `codigoRecuperacao` só vem preenchido quando um código novo foi gerado — é a única vez que ele é exibido. */
export type AuthResult = ActionResult<{ codigoRecuperacao?: string }>;

type Attempt = { count: number; resetAt: number };
// Guardado no globalThis também em produção: o Next pode carregar este módulo
// mais de uma vez (Server Actions e a rota /api/auth/login), e o limite de
// tentativas precisa ser um só.
const globalForAuth = globalThis as unknown as { genusLoginAttempts?: Map<string, Attempt> };
const attempts = (globalForAuth.genusLoginAttempts ??= new Map<string, Attempt>());

const TOO_MANY_ATTEMPTS = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const attempt = attempts.get(key);
  if (!attempt || attempt.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  attempt.count += 1;
  return attempt.count > 5;
}

export async function login(formData: FormData): Promise<AuthResult> {
  return runAction(async () => {
    const email = normalizeEmail(formData.get("email"));
    const password = cleanText(formData.get("password"), 128);
    const remember = formData.get("remember") === "on";

    if (!validEmail(email) || !password) throw new UserFacingError("E-mail ou senha inválidos.");
    if (isRateLimited(email)) throw new UserFacingError(TOO_MANY_ATTEMPTS);

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true, senhaHash: true, ativo: true },
    });
    const valid = usuario?.ativo ? await bcrypt.compare(password, usuario.senhaHash) : false;
    if (!usuario || !valid) throw new UserFacingError("E-mail ou senha inválidos.");

    attempts.delete(email);
    await createSession(usuario.id, remember);
    return {};
  });
}

export async function setupAdmin(formData: FormData): Promise<AuthResult> {
  return runAction(async () => {
    const nome = cleanText(formData.get("nome"), 120);
    const email = normalizeEmail(formData.get("email"));
    const password = cleanText(formData.get("password"), 128);
    const validationError = passwordError(password);

    if (nome.length < 2) throw new UserFacingError("Informe o nome do administrador.");
    if (!validEmail(email)) throw new UserFacingError("Informe um e-mail válido.");
    if (validationError) throw new UserFacingError(validationError);

    const senhaHash = await bcrypt.hash(password, 12);
    const codigoRecuperacao = generateRecoveryCode();
    const codigoRecuperacaoHash = await hashRecoveryCode(codigoRecuperacao);
    await prisma.$transaction(async (tx) => {
      if ((await tx.usuario.count()) > 0) {
        throw new UserFacingError("O administrador inicial já foi configurado. Entre com sua conta.");
      }
      return tx.usuario.create({
        data: { nome, email, senhaHash, role: "ADMIN", codigoRecuperacaoHash, codigoRecuperacaoEm: new Date() },
        select: { id: true },
      });
    });
    // Sem criar sessão aqui: a tela de login redireciona quem já está logado, e
    // o código de recuperação sumiria antes de ser lido. O login-form entra
    // (login) depois que o admin confirma que guardou o código.
    return { codigoRecuperacao };
  });
}

const RECOVERY_FAILED = "E-mail ou código de recuperação inválidos.";

/**
 * "Esqueci minha senha" de administrador: e-mail + código de recuperação.
 * O código usado é invalidado e um novo é gerado e devolvido para ser
 * guardado — cada código vale uma única vez.
 */
export async function recuperarAcessoAdmin(formData: FormData): Promise<AuthResult> {
  return runAction(async () => {
    const email = normalizeEmail(formData.get("email"));
    const codigo = cleanText(formData.get("codigo"), 64);
    const novaSenha = cleanText(formData.get("novaSenha"), 128);
    const confirmacao = cleanText(formData.get("confirmacao"), 128);

    if (!validEmail(email) || !codigo) throw new UserFacingError(RECOVERY_FAILED);
    const senhaInvalida = passwordError(novaSenha);
    if (senhaInvalida) throw new UserFacingError(senhaInvalida);
    if (novaSenha !== confirmacao) throw new UserFacingError("A confirmação não confere com a nova senha.");
    if (isRateLimited(`recuperar:${email}`)) throw new UserFacingError(TOO_MANY_ATTEMPTS);

    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true, role: true, ativo: true, codigoRecuperacaoHash: true },
    });
    const valido =
      usuario?.ativo && usuario.role === "ADMIN" && usuario.codigoRecuperacaoHash
        ? await verifyRecoveryCode(codigo, usuario.codigoRecuperacaoHash)
        : false;
    if (!usuario || !valido) throw new UserFacingError(RECOVERY_FAILED);

    attempts.delete(`recuperar:${email}`);
    const novoCodigo = generateRecoveryCode();
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senhaHash: await bcrypt.hash(novaSenha, 12),
        trocarSenha: false,
        codigoRecuperacaoHash: await hashRecoveryCode(novoCodigo),
        codigoRecuperacaoEm: new Date(),
      },
    });
    await deleteUserSessions(usuario.id);
    return { codigoRecuperacao: novoCodigo };
  });
}

export async function logout(): Promise<never> {
  await deleteCurrentSession();
  redirect("/login");
}
