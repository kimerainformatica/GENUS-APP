import { AuthCard } from "@/components/auth/auth-card";
import { RecoverAccessForm } from "@/components/auth/recover-access-form";

export default function RecuperarAcessoPage() {
  return (
    <AuthCard
      eyebrow="Esqueci minha senha"
      title="Recuperar acesso"
      description="Administradores redefinem a senha com o código de recuperação. Usuários comuns: peçam a um administrador para redefinir a senha em “Usuários”."
    >
      <RecoverAccessForm />
    </AuthCard>
  );
}
