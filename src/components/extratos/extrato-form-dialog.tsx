"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveExtrato } from "@/lib/actions/extratos";

export type ExtratoFormValues = {
  id: string;
  clienteId: string;
  instituicao: string | null;
  agencia: string | null;
  conta: string | null;
  periodoInicio: Date | null;
  periodoFim: Date | null;
  saldoInicial: number | null;
  saldoFinal: number | null;
  totalEntradas: number | null;
  totalSaidas: number | null;
};

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function ExtratoFormDialog({
  extrato,
  clientes,
  defaultClienteId,
  trigger,
}: {
  extrato?: ExtratoFormValues;
  clientes: { id: string; nome: string; cpfCnpj: string | null }[];
  defaultClienteId?: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isEdit = Boolean(extrato);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        const result = await saveExtrato(formData);
        setOpen(false);
        if (result.created) {
          router.push(`/extratos/${result.id}`);
        } else {
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar o extrato.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="max-w-lg">
        <DialogTitle>{isEdit ? "Editar extrato" : "Novo extrato"}</DialogTitle>
        <DialogDescription>Dados gerais do extrato — os lançamentos são editados na página do extrato.</DialogDescription>

        <form onSubmit={handleSubmit} className="mt-4 flex max-h-[65vh] flex-col gap-3 overflow-y-auto pr-1">
          {extrato && <input type="hidden" name="id" value={extrato.id} />}

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Cliente (CNPJ ou nome)</span>
            <select
              name="clienteId"
              required
              defaultValue={extrato?.clienteId ?? defaultClienteId ?? ""}
              className={selectClassName}
            >
              <option value="" disabled>
                Selecione um cliente
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} {c.cpfCnpj ? `— ${c.cpfCnpj}` : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="col-span-1 flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Banco</span>
              <Input name="instituicao" defaultValue={extrato?.instituicao ?? ""} placeholder="Ex: Nubank" />
            </label>
            <label className="col-span-1 flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Agência</span>
              <Input name="agencia" defaultValue={extrato?.agencia ?? ""} />
            </label>
            <label className="col-span-1 flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Conta</span>
              <Input name="conta" defaultValue={extrato?.conta ?? ""} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Período (início)</span>
              <Input type="date" name="periodoInicio" defaultValue={toDateInputValue(extrato?.periodoInicio ?? null)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Período (fim)</span>
              <Input type="date" name="periodoFim" defaultValue={toDateInputValue(extrato?.periodoFim ?? null)} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Saldo inicial</span>
              <Input type="number" step="0.01" name="saldoInicial" defaultValue={extrato?.saldoInicial ?? ""} className="[font-variant-numeric:tabular-nums]" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Saldo final</span>
              <Input type="number" step="0.01" name="saldoFinal" defaultValue={extrato?.saldoFinal ?? ""} className="[font-variant-numeric:tabular-nums]" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Total de entradas</span>
              <Input type="number" step="0.01" name="totalEntradas" defaultValue={extrato?.totalEntradas ?? ""} className="[font-variant-numeric:tabular-nums]" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Total de saídas</span>
              <Input type="number" step="0.01" name="totalSaidas" defaultValue={extrato?.totalSaidas ?? ""} className="[font-variant-numeric:tabular-nums]" />
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
