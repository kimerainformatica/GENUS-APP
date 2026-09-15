"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DashboardFilters({
  clientes,
  values,
}: {
  clientes: { id: string; nome: string }[];
  values: { clienteId?: string; inicio: string; fim: string };
}) {
  const router = useRouter();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const field of ["clienteId", "inicio", "fim"] as const) {
      const value = String(formData.get(field) ?? "").trim();
      if (value) params.set(field, value);
    }
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-card p-3 shadow-sm">
      <label className="flex min-w-44 flex-col gap-1 text-xs font-medium text-muted-foreground">
        Cliente
        <select
          name="clienteId"
          defaultValue={values.clienteId ?? ""}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="">Todos os clientes</option>
          {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nome}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Início
        <Input type="date" name="inicio" defaultValue={values.inicio} />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        Fim
        <Input type="date" name="fim" defaultValue={values.fim} />
      </label>
      <Button type="submit">Aplicar</Button>
      <Button type="button" variant="ghost" onClick={() => router.push("/dashboard")}>Limpar</Button>
    </form>
  );
}
