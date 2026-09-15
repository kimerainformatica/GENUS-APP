import { ShieldCheck, UserPlus } from "lucide-react";

import { CreateUserForm } from "@/components/admin/create-user-form";
import { PageBack } from "@/components/navigation/page-back";
import { requireAdmin } from "@/lib/auth/session";

export default async function CriarUsuarioPage() {
  await requireAdmin();

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-6 sm:py-10">
      <PageBack href="/dashboard" label="Voltar ao dashboard" />

      <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-gradient-to-r from-primary/10 to-card px-6 py-6 sm:px-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <UserPlus size={22} aria-hidden="true" />
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                <ShieldCheck size={16} aria-hidden="true" />
                Área administrativa
              </p>
              <h1 className="mt-1 text-2xl font-bold text-foreground">Criar novo usuário</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Cadastre um novo acesso e escolha se ele será administrador ou usuário comum.
              </p>
            </div>
          </div>
        </div>

        <CreateUserForm />
      </section>
    </main>
  );
}
