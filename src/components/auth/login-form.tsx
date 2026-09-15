"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login, setupAdmin } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LoginForm({ initialSetup }: { initialSetup: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      const result = initialSetup ? await setupAdmin(formData) : await login(formData);
      if (!result.success) return setError(result.error);
      router.replace("/dashboard");
      router.refresh();
    });
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
    </form>
  );
}
