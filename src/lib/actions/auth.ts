"use server";

import bcrypt from "bcrypt";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, deleteCurrentSession } from "@/lib/auth/session";
import { cleanText, normalizeEmail, passwordError, validEmail } from "@/lib/auth/validation";

export type AuthResult = { success: true } | { success: false; error: string };

type Attempt = { count: number; resetAt: number };
const globalForAuth = globalThis as unknown as { genusLoginAttempts?: Map<string, Attempt> };
const attempts = globalForAuth.genusLoginAttempts ?? new Map<string, Attempt>();
if (process.env.NODE_ENV !== "production") globalForAuth.genusLoginAttempts = attempts;

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
  const email = normalizeEmail(formData.get("email"));
  const password = cleanText(formData.get("password"), 128);
  const remember = formData.get("remember") === "on";

  if (!validEmail(email) || !password) return { success: false, error: "E-mail ou senha inválidos." };
  if (isRateLimited(email)) return { success: false, error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." };

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, senhaHash: true, ativo: true },
  });
  const valid = usuario?.ativo ? await bcrypt.compare(password, usuario.senhaHash) : false;
  if (!usuario || !valid) return { success: false, error: "E-mail ou senha inválidos." };

  attempts.delete(email);
  await createSession(usuario.id, remember);
  return { success: true };
}

export async function setupAdmin(formData: FormData): Promise<AuthResult> {
  const nome = cleanText(formData.get("nome"), 120);
  const email = normalizeEmail(formData.get("email"));
  const password = cleanText(formData.get("password"), 128);
  const validationError = passwordError(password);

  if (nome.length < 2) return { success: false, error: "Informe o nome do administrador." };
  if (!validEmail(email)) return { success: false, error: "Informe um e-mail válido." };
  if (validationError) return { success: false, error: validationError };

  const senhaHash = await bcrypt.hash(password, 12);
  try {
    const usuario = await prisma.$transaction(async (tx) => {
      if ((await tx.usuario.count()) > 0) throw new Error("SETUP_ALREADY_DONE");
      return tx.usuario.create({ data: { nome, email, senhaHash, role: "ADMIN" }, select: { id: true } });
    });
    await createSession(usuario.id, false);
    return { success: true };
  } catch {
    return { success: false, error: "O administrador inicial já foi configurado. Entre com sua conta." };
  }
}

export async function logout(): Promise<never> {
  await deleteCurrentSession();
  redirect("/login");
}
