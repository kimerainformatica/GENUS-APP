"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { recuperarAcessoAdmin } from "@/lib/actions/auth";
import { RecoveryCodeDisplay } from "@/components/auth/recovery-code-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const inputClass = "mt-1.5 h-11 rounded-xl bg-muted/40 px-4";

export function RecoverAccessForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      const result = await recuperarAcessoAdmin(formData);
      if (!result.success) return setError(result.error);
      setNewCode(result.codigoRecuperacao ?? null);
    });
  }

  if (newCode) {
    return (
      <div className="space-y-4">
        <p role="status" className="rounded-lg bg-emerald-600/10 p-3 text-sm text-emerald-700">
          Senha redefinida. O código que você usou deixou de valer — guarde o código novo abaixo.
        </p>
        <RecoveryCodeDisplay code={newCode} continueLabel="Ir para o login" onContinue={() => router.replace("/login")} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <label className="block text-sm font-medium text-foreground">
        E-mail do administrador
        <Input type="email" name="email" autoComplete="email" maxLength={254} required className={inputClass} />
      </label>
      <label className="block text-sm font-medium text-foreground">
        Código de recuperação
        <Input name="codigo" autoComplete="off" spellCheck={false} maxLength={64} required placeholder="XXXXX-XXXXX-XXXXX-XXXXX" className={`${inputClass} font-mono uppercase tracking-wider`} />
      </label>
      <label className="block text-sm font-medium text-foreground">
        Nova senha
        <Input type="password" name="novaSenha" autoComplete="new-password" minLength={10} maxLength={128} required className={inputClass} />
      </label>
      <label className="block text-sm font-medium text-foreground">
        Confirmar nova senha
        <Input type="password" name="confirmacao" autoComplete="new-password" minLength={10} maxLength={128} required className={inputClass} />
        <span className="mt-1 block text-xs font-normal text-muted-foreground">Mínimo de 10 caracteres, com maiúscula, minúscula, número e símbolo.</span>
      </label>
      <Button type="submit" disabled={pending} className="h-12 w-full rounded-xl text-sm">
        {pending ? "Verificando…" : "Redefinir senha"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Voltar ao login
        </Link>
      </p>
    </form>
  );
}
