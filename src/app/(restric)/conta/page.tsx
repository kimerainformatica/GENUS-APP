import { KeyRound, LockKeyhole, UserRound } from "lucide-react";
import { ChangePasswordForm } from "@/components/conta/change-password-form";
import { RecoveryCodeSection } from "@/components/conta/recovery-code-section";
import { PageBack } from "@/components/navigation/page-back";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function ContaPage() {
  const session = await requireSession();
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { codigoRecuperacaoEm: true, createdAt: true },
  });
  const isAdmin = session.user.role === "ADMIN";
  const generatedAt = usuario?.codigoRecuperacaoEm?.toLocaleDateString("pt-BR") ?? null;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-6 sm:py-10">
      <PageBack href="/dashboard" label="Voltar ao dashboard" />

      <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
          <UserRound size={16} aria-hidden="true" />
          Minha conta
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">{session.user.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {session.user.email} · {isAdmin ? "Administrador" : "Usuário comum"}
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <LockKeyhole size={18} aria-hidden="true" />
          Alterar senha
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">Ao trocar a senha, os outros acessos abertos com a senha antiga são encerrados.</p>
        <ChangePasswordForm />
      </section>

      {isAdmin && (
        <section id="recuperacao" className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <KeyRound size={18} aria-hidden="true" />
            Código de recuperação
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            Permite redefinir a sua senha em &ldquo;Esqueci minha senha&rdquo;, na tela de login, mesmo que nenhum outro administrador lembre a dele.
          </p>
          <RecoveryCodeSection hasCode={session.user.temCodigoRecuperacao} generatedAt={generatedAt} />
        </section>
      )}

      {!isAdmin && (
        <p className="mt-6 text-sm text-muted-foreground">Esqueceu a senha? Peça a um administrador para redefini-la em &ldquo;Usuários&rdquo;.</p>
      )}
    </main>
  );
}
