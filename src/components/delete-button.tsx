"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";

// `deleteExtrato` chama redirect("/extratos") após excluir com sucesso —
// isso lança um erro especial (digest "NEXT_REDIRECT;...") que o Next.js
// usa para navegar. Sem checar isso aqui, o try/catch abaixo o interceptaria
// como se fosse uma falha real e mostraria um erro em vez de navegar.
function isRedirectError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "digest" in error && typeof error.digest === "string" && error.digest.startsWith("NEXT_REDIRECT");
}

export function DeleteButton({
  onDelete,
  itemLabel,
}: {
  onDelete: () => Promise<void>;
  itemLabel: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await onDelete();
      } catch (err) {
        if (isRedirectError(err)) throw err;
        setError(err instanceof Error ? err.message : "Não foi possível excluir.");
      }
    });
  }

  return (
    <Dialog onOpenChange={(open) => !open && setError(null)}>
      <DialogTrigger
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Excluir ${itemLabel}`}
      >
        <Trash2 size={15} />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Excluir {itemLabel}?</DialogTitle>
        <DialogDescription>Essa ação não pode ser desfeita.</DialogDescription>
        {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose className={buttonVariants({ variant: "ghost" })}>Cancelar</DialogClose>
          <Button
            type="button"
            disabled={pending}
            onClick={handleDelete}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending ? "Excluindo…" : "Excluir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
