"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";

export function DeleteButton({
  onDelete,
  itemLabel,
}: {
  onDelete: () => Promise<void>;
  itemLabel: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Dialog>
      <DialogTrigger
        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label={`Excluir ${itemLabel}`}
      >
        <Trash2 size={15} />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Excluir {itemLabel}?</DialogTitle>
        <DialogDescription>Essa ação não pode ser desfeita.</DialogDescription>
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose className={buttonVariants({ variant: "ghost" })}>Cancelar</DialogClose>
          <Button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => onDelete())}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {pending ? "Excluindo…" : "Excluir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
