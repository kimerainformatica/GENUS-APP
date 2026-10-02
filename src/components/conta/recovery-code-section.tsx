"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gerarCodigoRecuperacao } from "@/lib/actions/conta";
import { callAction } from "@/lib/call-action";
import { RecoveryCodeDisplay } from "@/components/auth/recovery-code-display";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** "Minha conta" de administrador: gera um código de recuperação novo (pede a senha atual). */
export function RecoveryCodeSection({ hasCode, generatedAt }: { hasCode: boolean; generatedAt: string | null }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError("");
    startTransition(async () => {
      const result = await callAction(() => gerarCodigoRecuperacao(formData));
      if (!result.success) return setError(result.error);
      form.reset();
      setCode(result.codigoRecuperacao ?? null);
    });
  }

  if (code) {
    return (
      <RecoveryCodeDisplay
        code={code}
        continueLabel="Concluir"
        onContinue={() => {
          setCode(null);
          router.refresh();
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {hasCode ? (
        <p className="text-sm text-muted-foreground">
          Você já tem um código de recuperação{generatedAt ? ` (gerado em ${generatedAt})` : ""}. Gerar um novo invalida o anterior.
        </p>
      ) : (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900">
          Você ainda não tem um código de recuperação. Sem ele, se esquecer a senha, não há como recuperar o acesso de administrador.
        </p>
      )}
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm font-medium text-foreground">
          Confirme sua senha atual
          <Input type="password" name="senhaAtual" autoComplete="current-password" maxLength={128} required className="mt-1.5 h-11 rounded-xl bg-muted/40 px-4" />
        </label>
        <Button type="submit" disabled={pending} className="h-11">
          {pending ? "Gerando…" : hasCode ? "Gerar novo código" : "Gerar código de recuperação"}
        </Button>
      </div>
    </form>
  );
}
