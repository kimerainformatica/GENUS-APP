"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveCliente } from "@/lib/actions/clientes";

export type ClienteFormValues = {
  id: string;
  nome: string;
  cpfCnpj: string | null;
  email: string | null;
  telefone: string | null;
};

export function ClienteFormDialog({ cliente, trigger }: { cliente?: ClienteFormValues; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(cliente);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await saveCliente(formData);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar o cliente.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogTitle>{isEdit ? "Editar cliente" : "Novo cliente"}</DialogTitle>
        <DialogDescription>Dados do cliente ou empresa atendida pela contabilidade.</DialogDescription>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          {cliente && <input type="hidden" name="id" value={cliente.id} />}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Nome / Razão social</span>
            <Input name="nome" defaultValue={cliente?.nome} required />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">CPF / CNPJ</span>
            <Input name="cpfCnpj" defaultValue={cliente?.cpfCnpj ?? ""} placeholder="00.000.000/0000-00" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">E-mail</span>
              <Input type="email" name="email" defaultValue={cliente?.email ?? ""} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Telefone</span>
              <Input name="telefone" defaultValue={cliente?.telefone ?? ""} />
            </label>
          </div>

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <DialogClose className={buttonVariants({ variant: "ghost" })}>Cancelar</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
