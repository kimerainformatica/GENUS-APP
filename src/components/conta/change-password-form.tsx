"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { alterarMinhaSenha } from "@/lib/actions/conta";
import { callAction } from "@/lib/call-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const inputClass = "mt-1.5 h-11 rounded-xl bg-muted/40 px-4";

/** Troca da própria senha — usado em "Minha conta" e na troca obrigatória (/trocar-senha). */
export function ChangePasswordForm({
  currentLabel = "Senha atual",
  redirectTo,
}: {
  currentLabel?: string;
  /** Para onde ir depois de trocar (troca obrigatória → dashboard). Sem isso, só mostra a confirmação. */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setError("");
    setDone(false);
    startTransition(async () => {
      const result = await callAction(() => alterarMinhaSenha(formData));
      if (!result.success) return setError(result.error);
      form.reset();
      if (redirectTo) {
        router.replace(redirectTo);
        router.refresh();
        return;
      }
      setDone(true);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {done && (
        <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-600/10 p-3 text-sm text-emerald-700">
          <CheckCircle2 size={16} aria-hidden="true" />
          Senha alterada. Outros acessos com a senha antiga foram encerrados.
        </p>
      )}
      <label className="block text-sm font-medium text-foreground">
        {currentLabel}
        <Input type="password" name="senhaAtual" autoComplete="current-password" maxLength={128} required className={inputClass} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-foreground">
          Nova senha
          <Input type="password" name="novaSenha" autoComplete="new-password" minLength={10} maxLength={128} required className={inputClass} />
        </label>
        <label className="block text-sm font-medium text-foreground">
          Confirmar nova senha
          <Input type="password" name="confirmacao" autoComplete="new-password" minLength={10} maxLength={128} required className={inputClass} />
        </label>
      </div>
      <p className="text-xs text-muted-foreground">Mínimo de 10 caracteres, com maiúscula, minúscula, número e símbolo.</p>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Alterar senha"}
        </Button>
      </div>
    </form>
  );
}
