"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Mostra um código de recuperação recém-gerado. Só o hash fica salvo no
 * banco: depois que este componente some, não há como ver o código de novo.
 */
export function RecoveryCodeDisplay({
  code,
  onContinue,
  continueLabel = "Continuar",
}: {
  code: string;
  onContinue: () => void;
  continueLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900">
        <p className="flex items-center gap-2 font-semibold">
          <KeyRound size={16} aria-hidden="true" />
          Código de recuperação de administrador
        </p>
        <p className="mt-1">
          Guarde este código em local seguro (papel, cofre de senhas). Se você esquecer a senha, ele é a única forma de
          recuperar o acesso. <strong>Ele não será mostrado de novo.</strong>
        </p>
      </div>

      <div className="space-y-2">
        {/* Uma linha só: o código costuma ser copiado à mão para o papel. */}
        <code className="block select-all overflow-x-auto whitespace-nowrap rounded-xl border border-border bg-muted/40 px-3 py-3 text-center font-mono text-base font-semibold tracking-wide text-foreground">
          {code}
        </code>
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={copy} aria-label="Copiar código">
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} className="h-4 w-4 rounded border-border" />
        Guardei o código em local seguro
      </label>

      <Button type="button" className="w-full" disabled={!saved} onClick={onContinue}>
        {continueLabel}
      </Button>
    </div>
  );
}
