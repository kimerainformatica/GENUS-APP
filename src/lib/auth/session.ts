import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "genus_session";
const SHORT_SESSION_MS = 8 * 60 * 60 * 1000;
const REMEMBER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(usuarioId: string, remember: boolean): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + (remember ? REMEMBER_SESSION_MS : SHORT_SESSION_MS));

  await prisma.$transaction([
    prisma.sessao.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    prisma.sessao.create({ data: { usuarioId, tokenHash: hashToken(token), expiresAt } }),
  ]);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export const getSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessao = await prisma.sessao.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      usuario: { select: { id: true, nome: true, email: true, role: true, ativo: true } },
    },
  });

  if (!sessao || sessao.expiresAt <= new Date() || !sessao.usuario.ativo) return null;

  return {
    sessionId: sessao.id,
    user: {
      id: sessao.usuario.id,
      name: sessao.usuario.nome,
      email: sessao.usuario.email,
      role: sessao.usuario.role,
    },
  };
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") redirect("/dashboard");
  return session;
}

export async function deleteCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await prisma.sessao.deleteMany({ where: { tokenHash: hashToken(token) } });
  cookieStore.delete(SESSION_COOKIE);
}
