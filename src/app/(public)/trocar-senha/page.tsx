import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ChangePasswordForm } from "@/components/conta/change-password-form";
import { logout } from "@/lib/actions/auth";
import { requireSession } from "@/lib/auth/session";

// Troca obrigatória: um admin definiu uma senha temporária para este usuário.
// requireSession() manda para cá qualquer página enquanto a troca estiver pendente.
export default async function TrocarSenhaPage() {
  const session = await requireSession({ allowPendingPasswordChange: true });
  if (!session.user.trocarSenha) redirect("/dashboard");

  return (
    <AuthCard
      eyebrow="Segurança"
      title="Crie a sua senha"
      description={`Olá, ${session.user.name}. Um administrador definiu uma senha temporária para você. Para continuar, crie uma senha que só você saiba.`}
    >
      <ChangePasswordForm currentLabel="Senha temporária" redirectTo="/dashboard" />
      <form action={logout} className="mt-4 text-center">
        <button type="submit" className="text-sm font-medium text-muted-foreground hover:text-primary">
          Sair
        </button>
      </form>
    </AuthCard>
  );
}
