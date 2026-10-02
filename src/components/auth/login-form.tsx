"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login, setupAdmin } from "@/lib/actions/auth";
import { callAction } from "@/lib/call-action";
import { RecoveryCodeDisplay } from "@/components/auth/recovery-code-display";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LoginForm({ initialSetup }: { initialSetup: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [setupDone, setSetupDone] = useState<{ code: string; credentials: FormData } | null>(null);
  const [pending, startTransition] = useTransition();

  function goToDashboard() {
    router.replace("/dashboard");
    router.refresh();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      const result = await callAction(() => (initialSetup ? setupAdmin(formData) : login(formData)));
      if (!result.success) return setError(result.error);
      // Primeiro administrador: mostra o código de recuperação e só entra depois.
      if (result.codigoRecuperacao) return setSetupDone({ code: result.codigoRecuperacao, credentials: formData });
      goToDashboard();
    });
  }

  function enterAfterSetup() {
    if (!setupDone) return;
    startTransition(async () => {
      const result = await callAction(() => login(setupDone.credentials));
      if (!result.success) {
        setSetupDone(null);
        router.refresh(); // a tela deixa de ser "criar administrador" e vira o login normal
        return setError("Administrador criado. Entre com o e-mail e a senha que você acabou de definir.");
      }
      goToDashboard();
    });
  }

  if (setupDone) {
    return <RecoveryCodeDisplay code={setupDone.code} onContinue={enterAfterSetup} continueLabel={pending ? "Entrando…" : "Entrar no Genus Portal"} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {initialSetup && (
        <label className="block text-sm font-medium text-foreground">
          Nome do administrador
          <Input name="nome" autoComplete="name" maxLength={120} required className="mt-1.5 h-11 rounded-xl bg-muted/40 px-4" />
        </label>
      )}
      <label className="block text-sm font-medium text-foreground">
        E-mail corporativo
        <Input type="email" name="email" autoComplete="email" maxLength={254} required placeholder="voce@empresa.com.br" className="mt-1.5 h-11 rounded-xl bg-muted/40 px-4" />
      </label>
      <label className="block text-sm font-medium text-foreground">
        Senha
        <Input type="password" name="password" autoComplete={initialSetup ? "new-password" : "current-password"} minLength={initialSetup ? 10 : undefined} maxLength={128} required placeholder="••••••••••" className="mt-1.5 h-11 rounded-xl bg-muted/40 px-4" />
        {initialSetup && <span className="mt-1 block text-xs font-normal text-muted-foreground">Mínimo de 10 caracteres, com maiúscula, minúscula, número e símbolo.</span>}
      </label>
      {!initialSetup && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" name="remember" className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
          Manter acesso por 30 dias
        </label>
      )}
      <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl text-sm shadow-lg shadow-primary/25">
        {pending ? "Processando…" : initialSetup ? "Criar administrador" : "Entrar na plataforma"}
      </Button>
      {!initialSetup && (
        <p className="text-center text-sm">
          <Link href="/recuperar-acesso" className="font-medium text-primary hover:underline">
            Esqueci minha senha
          </Link>
        </p>
      )}
    </form>
  );
}
