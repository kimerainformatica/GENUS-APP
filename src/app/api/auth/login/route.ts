import { NextResponse } from "next/server";

import { login } from "@/lib/actions/auth";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Dados de acesso inválidos." }, { status: 400 });

    const { email, password } = body as { email?: unknown; password?: unknown };
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "Preencha e-mail e senha." }, { status: 400 });
    }

    const formData = new FormData();
    formData.set("email", email);
    formData.set("password", password);
    const result = await login(formData);
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 401 });

    return NextResponse.json({ message: "Login realizado com sucesso." });
  } catch {
    return NextResponse.json({ error: "Erro ao tentar fazer login." }, { status: 500 });
  }
}
