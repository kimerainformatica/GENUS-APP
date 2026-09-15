import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/session";
import { cleanText, normalizeEmail, passwordError, validEmail } from "@/lib/auth/validation";
import { prisma } from "@/lib/prisma";

const userFields = { id: true, nome: true, email: true, role: true, ativo: true, createdAt: true } as const;

async function authorizeAdmin() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) };
  if (session.user.role !== "ADMIN") return { error: NextResponse.json({ error: "Sem permissão." }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const authorization = await authorizeAdmin();
  if ("error" in authorization) return authorization.error;

  try {
    return NextResponse.json(await prisma.usuario.findMany({ select: userFields, orderBy: { createdAt: "desc" } }));
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar os usuários." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await authorizeAdmin();
  if ("error" in authorization) return authorization.error;

  try {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    const { nome: rawNome, email: rawEmail, password: rawPassword, role } = body as Record<string, unknown>;
    const nome = cleanText(rawNome, 120);
    const email = normalizeEmail(rawEmail);
    const password = cleanText(rawPassword, 128);
    const validationError = passwordError(password);

    if (nome.length < 2) return NextResponse.json({ error: "Informe o nome do usuário." }, { status: 400 });
    if (!validEmail(email)) return NextResponse.json({ error: "Informe um e-mail válido." }, { status: 400 });
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    if (role !== "ADMIN" && role !== "USER") return NextResponse.json({ error: "Selecione um cargo válido." }, { status: 400 });
    if (await prisma.usuario.findUnique({ where: { email }, select: { id: true } })) {
      return NextResponse.json({ error: "Este e-mail já está cadastrado." }, { status: 409 });
    }

    const user = await prisma.usuario.create({
      data: { nome, email, senhaHash: await bcrypt.hash(password, 12), role },
      select: userFields,
    });
    return NextResponse.json({ message: "Usuário criado com sucesso.", user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Não foi possível criar o usuário." }, { status: 500 });
  }
}
