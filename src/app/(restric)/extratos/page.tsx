import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ExtratoFormDialog } from "@/components/extratos/extrato-form-dialog";
import { UploadExtratoDialog } from "@/components/upload-extrato-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";

function formatCurrency(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export default async function ExtratosPage() {
  await requireSession();
  const [extratos, clientes] = await Promise.all([
    prisma.extrato.findMany({
      orderBy: { createdAt: "desc" },
      include: { cliente: true, _count: { select: { transacoes: true } } },
    }),
    prisma.cliente.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, cpfCnpj: true } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Extratos bancários</p>
          <h1 className="mt-1 text-3xl font-bold text-foreground">Extratos</h1>
          <p className="mt-2 text-muted-foreground">Extratos importados de PDF, com os lançamentos de cada cliente.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {clientes.length > 0 && <UploadExtratoDialog clientes={clientes} />}
          <ExtratoFormDialog
            clientes={clientes}
            trigger={
              <Button disabled={clientes.length === 0}>
                <Plus size={16} aria-hidden="true" />
                Novo extrato
              </Button>
            }
          />
        </div>
      </div>

      {clientes.length === 0 && (
        <p className="mb-6 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
          Cadastre um cliente primeiro em{" "}
          <Link href="/clientes" className="font-semibold underline underline-offset-2">
            Clientes
          </Link>{" "}
          para poder criar um extrato.
        </p>
      )}

      {extratos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <FileText size={28} className="text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Nenhum extrato cadastrado ainda.</p>
          <p className="text-xs text-muted-foreground">Importe um PDF no dashboard ou cadastre um extrato manualmente aqui.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Banco</th>
                <th className="px-5 py-3 font-medium">Agência / Conta</th>
                <th className="px-5 py-3 font-medium">Período</th>
                <th className="px-5 py-3 font-medium">Saldo final</th>
                <th className="px-5 py-3 font-medium">Importação</th>
                <th className="px-5 py-3 font-medium">Lançamentos</th>
              </tr>
            </thead>
            <tbody>
              {extratos.map((extrato) => (
                <tr key={extrato.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                  <td className="px-5 py-3.5">
                    <Link href={`/extratos/${extrato.id}`} className="font-medium text-foreground hover:text-primary">
                      {extrato.cliente.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{extrato.instituicao ?? "—"}</td>
                  <td className="px-5 py-3.5 text-muted-foreground [font-variant-numeric:tabular-nums]">
                    {extrato.agencia ?? "—"} / {extrato.conta ?? "—"}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground [font-variant-numeric:tabular-nums]">
                    {formatDate(extrato.periodoInicio)} – {formatDate(extrato.periodoFim)}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-foreground [font-variant-numeric:tabular-nums]">
                    {formatCurrency(extrato.saldoFinal)}
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    {extrato.origem === "IMPORTADO" ? (
                      <Badge
                        variant="outline"
                        className={
                          extrato.reconciliacaoOk === true
                            ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700"
                            : extrato.reconciliacaoOk === false
                              ? "border-destructive/30 bg-destructive/10 text-destructive"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-700"
                        }
                      >
                        {extrato.reconciliacaoOk === true ? "Conciliado" : extrato.reconciliacaoOk === false ? "Divergente" : "Sem conferência"}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Manual</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{extrato._count.transacoes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
