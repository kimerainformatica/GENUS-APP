"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-types";
import { callAction } from "@/lib/call-action";

export function DeleteButton({
  onDelete,
  itemLabel,
  redirectTo,
}: {
  onDelete: () => Promise<ActionResult>;
  itemLabel: string;
  /** Para onde ir depois de excluir (ex.: a página do item excluído deixa de existir). */
  redirectTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await callAction(onDelete);
      if (!result.success) return setError(result.error);
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Excluir ${itemLabel}`}
      >
        <Trash2 size={15} />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Excluir {itemLabel}?</DialogTitle>
        <DialogDescription>Essa ação não pode ser desfeita.</DialogDescription>
        {error && <p role="alert" className="mt-2 text-xs font-medium text-destructive">{error}</p>}
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
