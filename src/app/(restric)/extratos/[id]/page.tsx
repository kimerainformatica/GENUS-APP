import Link from "next/link";
import { notFound } from "next/navigation";
import { CircleAlert, Pencil, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { deleteExtrato, deleteTransacao } from "@/lib/actions/extratos";
import { ExtratoFormDialog } from "@/components/extratos/extrato-form-dialog";
import { TransacaoFormDialog } from "@/components/extratos/transacao-form-dialog";
import { DeleteButton } from "@/components/delete-button";
import { PageBack } from "@/components/navigation/page-back";
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

function isUnclassified(tipo: string, categoria: string): boolean {
  return tipo === "Não classificado" || categoria === "Outros";
}

export default async function ExtratoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const [extrato, clientes] = await Promise.all([
    prisma.extrato.findUnique({
      where: { id },
      include: { cliente: true, transacoes: { orderBy: { data: "asc" } } },
    }),
    prisma.cliente.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true, cpfCnpj: true } }),
  ]);

  if (!extrato) notFound();

  const pendentesCount = extrato.transacoes.filter((t) => isUnclassified(t.tipo, t.categoria)).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <PageBack href="/extratos" label="Voltar para Extratos" />

      <div className="mt-6 mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`/clientes/${extrato.cliente.id}`} className="text-sm font-medium text-primary hover:underline hover:underline-offset-4">
            {extrato.cliente.nome}
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-foreground">
            {extrato.instituicao ?? "Extrato"} — {extrato.agencia ?? "—"} / {extrato.conta ?? "—"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(extrato.periodoInicio)} a {formatDate(extrato.periodoFim)}
          </p>
        </div>
        <div className="flex gap-2">
          <ExtratoFormDialog
            extrato={extrato}
            clientes={clientes}
            trigger={
              <Button variant="outline">
                <Pencil size={15} aria-hidden="true" />
                Editar extrato
              </Button>
            }
          />
          <DeleteButton itemLabel="este extrato" onDelete={deleteExtrato.bind(null, extrato.id)} />
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Saldo inicial</p>
          <p className="mt-1 text-xl font-bold text-foreground">{formatCurrency(extrato.saldoInicial)}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total de entradas</p>
          <p className="mt-1 text-xl font-bold text-primary">{formatCurrency(extrato.totalEntradas)}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Total de saídas</p>
          <p className="mt-1 text-xl font-bold text-destructive">{formatCurrency(extrato.totalSaidas)}</p>
        </article>
        <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Saldo final</p>
          <p className="mt-1 text-xl font-bold text-foreground">{formatCurrency(extrato.saldoFinal)}</p>
        </article>
      </section>

      {extrato.origem === "IMPORTADO" && (
        <section className={`mt-4 rounded-2xl border p-4 text-sm ${extrato.reconciliacaoOk === false ? "border-destructive/30 bg-destructive/5 text-destructive" : extrato.reconciliacaoOk === true ? "border-emerald-600/30 bg-emerald-600/5 text-emerald-700" : "border-amber-500/30 bg-amber-500/5 text-amber-700"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Importado pelo GENUS-APP · {extrato.arquivoNome ?? "PDF bancário"}</p>
            <p>{extrato.reconciliacaoOk === true ? "Saldo conciliado" : extrato.reconciliacaoOk === false ? "Atenção: saldo divergente" : "Conciliação automática indisponível"}</p>
          </div>
          {(extrato.periodoDeclarado || extrato.somaCalculada !== null) && <p className="mt-1 text-xs opacity-80">Período declarado: {extrato.periodoDeclarado ?? "não identificado"} · Soma líquida extraída: {formatCurrency(extrato.somaCalculada)}</p>}
        </section>
      )}

      <div className="mt-8 mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-foreground">Lançamentos ({extrato.transacoes.length})</h2>
          {pendentesCount > 0 && (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700">
              <CircleAlert size={12} aria-hidden="true" />
              {pendentesCount} para classificar
            </Badge>
          )}
        </div>
        <TransacaoFormDialog
          extratoId={extrato.id}
          trigger={
            <Button>
              <Plus size={16} aria-hidden="true" />
              Novo lançamento
            </Button>
          }
        />
      </div>

      {extrato.transacoes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center text-sm text-muted-foreground">
          Nenhum lançamento neste extrato ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-5 py-3 font-medium">Categoria</th>
                <th className="px-5 py-3 font-medium">Tipo / contraparte</th>
                <th className="px-5 py-3 text-right font-medium">Valor</th>
                <th className="px-5 py-3 text-right font-medium">Tarifa</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {extrato.transacoes.map((t) => {
                const pendente = isUnclassified(t.tipo, t.categoria);
                return (
                  <tr key={t.id} className={`border-b border-border/60 last:border-0 ${pendente ? "bg-amber-500/[0.04]" : ""}`}>
                    <td className="px-5 py-3 text-muted-foreground [font-variant-numeric:tabular-nums]">{formatDate(t.data)}</td>
                    <td className="px-5 py-3">
                      <Badge variant={t.categoria === "Outros" ? "outline" : "secondary"} className={t.categoria === "Outros" ? "border-amber-500/40 text-amber-700" : ""}>
                        {t.categoria}
                      </Badge>
                    </td>
                    <td className="max-w-xs px-5 py-3">
                      <p className="font-medium text-foreground">{t.nomeContraparte ?? t.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.tipo === "Não classificado" ? <span className="font-medium text-amber-700">Não classificado</span> : t.tipo}
                        {t.identificador ? ` · ${t.identificador}` : ""}
                      </p>
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-medium [font-variant-numeric:tabular-nums] ${
                        t.valor >= 0 ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {formatCurrency(t.valor)}
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground [font-variant-numeric:tabular-nums]">{formatCurrency(t.tarifaTaxa)}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <TransacaoFormDialog
                          extratoId={extrato.id}
                          transacao={t}
                          trigger={
                            pendente ? (
                              <Button variant="outline" size="sm" className="border-amber-500/40 text-amber-700 hover:bg-amber-500/10">
                                <Pencil size={13} aria-hidden="true" />
                                Classificar
                              </Button>
                            ) : (
                              <Button variant="ghost" size="icon-sm" aria-label="Editar lançamento">
                                <Pencil size={15} />
                              </Button>
                            )
                          }
                        />
                        <DeleteButton itemLabel="este lançamento" onDelete={deleteTransacao.bind(null, t.id, extrato.id)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
