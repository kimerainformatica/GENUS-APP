"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveTransacao } from "@/lib/actions/extratos";
import { EXPENSE_CATEGORIES } from "@/lib/extratos/categories";

export type TransacaoFormValues = {
  id: string;
  data: Date;
  tipo: string;
  categoria: string;
  descricao: string;
  identificador: string | null;
  nomeContraparte: string | null;
  tarifaTaxa: number | null;
  valorBruto: number | null;
  valor: number;
  saldoApos: number | null;
};

const TIPOS_SUGERIDOS = [
  "PIX recebido",
  "PIX enviado",
  "TED recebida",
  "TED enviada",
  "Pagamento de boleto",
  "Compra no cartão",
  "Tarifa bancária",
  "Rendimento",
  "Estorno",
  "Saque",
];

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function TransacaoFormDialog({
  extratoId,
  transacao,
  trigger,
}: {
  extratoId: string;
  transacao?: TransacaoFormValues;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(transacao);
  const isUnclassified = !transacao || transacao.tipo === "Não classificado";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await saveTransacao(formData);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível salvar o lançamento.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogTitle>{isEdit ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        <DialogDescription>
          {isUnclassified
            ? "Defina o tipo e a categoria deste lançamento — os dois campos abaixo aceitam qualquer texto e podem ser trocados livremente."
            : "Data, descrição e valores do lançamento do extrato."}
        </DialogDescription>

        <form onSubmit={handleSubmit} className="mt-4 flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
          <input type="hidden" name="extratoId" value={extratoId} />
          {transacao && <input type="hidden" name="id" value={transacao.id} />}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Data</span>
              <Input type="date" name="data" required defaultValue={transacao ? toDateInputValue(transacao.data) : ""} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">
                Tipo
                {isUnclassified && <span className="ml-1 font-normal text-amber-600">· clique e digite para classificar</span>}
              </span>
              <Input
                name="tipo"
                list="tipos-lancamento"
                autoFocus={isUnclassified}
                placeholder="Ex: PIX recebido"
                defaultValue={transacao && transacao.tipo !== "Não classificado" ? transacao.tipo : ""}
                className={isUnclassified ? "border-amber-500/50 ring-2 ring-amber-500/15" : ""}
              />
              <datalist id="tipos-lancamento">
                {TIPOS_SUGERIDOS.map((tipo) => (
                  <option key={tipo} value={tipo} />
                ))}
              </datalist>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Categoria de gasto</span>
            <select name="categoria" defaultValue={transacao?.categoria ?? "Outros"} className={selectClassName}>
              {EXPENSE_CATEGORIES.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Descrição</span>
            <Input name="descricao" required defaultValue={transacao?.descricao} />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Contraparte</span>
            <Input
              name="nomeContraparte"
              maxLength={500}
              defaultValue={transacao?.nomeContraparte ?? transacao?.descricao ?? ""}
              placeholder="Pessoa ou empresa relacionada"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">ID da operação</span>
            <Input name="identificador" defaultValue={transacao?.identificador ?? ""} placeholder="Opcional" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Valor</span>
              <Input
                type="number"
                step="0.01"
                name="valor"
                required
                defaultValue={transacao?.valor}
                placeholder="Negativo para saída"
                className="[font-variant-numeric:tabular-nums]"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Saldo após</span>
              <Input
                type="number"
                step="0.01"
                name="saldoApos"
                defaultValue={transacao?.saldoApos ?? ""}
                placeholder="Opcional"
                className="[font-variant-numeric:tabular-nums]"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Valor bruto</span>
              <Input type="number" step="0.01" name="valorBruto" defaultValue={transacao?.valorBruto ?? ""} placeholder="Opcional" className="[font-variant-numeric:tabular-nums]" />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">Tarifa / taxa</span>
              <Input type="number" min="0" step="0.01" name="tarifaTaxa" defaultValue={transacao?.tarifaTaxa ?? ""} placeholder="0,00" className="[font-variant-numeric:tabular-nums]" />
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
