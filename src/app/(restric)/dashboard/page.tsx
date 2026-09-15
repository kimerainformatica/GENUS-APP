import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Building2, CircleAlert, FileQuestion, FileText, Landmark, ReceiptText, WalletCards } from "lucide-react";
import { AccountBalanceChart } from "@/components/charts/account-balance-chart";
import { CategoryBreakdownChart } from "@/components/charts/category-breakdown-chart";
import { RecentTransactions } from "@/components/charts/recent-transactions";
import { SpendingTrendChart } from "@/components/charts/spending-trend-chart";
import { StatTile } from "@/components/charts/stat-tile";
import { DashboardFilters } from "@/components/dashboard-filters";
import { UploadExtratoDialog } from "@/components/upload-extrato-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { getDashboardData } from "@/lib/dashboard-data";
import { formatCurrency } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ clienteId?: string; inicio?: string; fim?: string }>;
}) {
  await requireSession();
  const filters = await searchParams;
  const [clientesCount, extratosCount, movimentacoesCount, contasExtratos, clientes, dashboard] = await Promise.all([
    prisma.cliente.count(),
    prisma.extrato.count(),
    prisma.transacao.count(),
    prisma.extrato.findMany({ select: { clienteId: true, instituicao: true, agencia: true, conta: true } }),
    prisma.cliente.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    getDashboardData(filters),
  ]);
  const contasBancariasCount = new Set(contasExtratos.map((item) => `${item.clienteId}|${item.instituicao ?? "Banco"}|${item.agencia ?? ""}|${item.conta ?? ""}`)).size;
  const clienteSelecionado = filters.clienteId ? clientes.find((cliente) => cliente.id === filters.clienteId) : undefined;
  const escopoLabel = clienteSelecionado?.nome ?? "todos os clientes";
  const overview = [
    { label: "Clientes", value: String(clientesCount), icon: Building2 },
    { label: "Contas identificadas", value: String(contasBancariasCount), icon: Landmark },
    { label: "Extratos", value: String(extratosCount), icon: FileText },
    { label: "Movimentações", value: String(movimentacoesCount), icon: WalletCards },
  ];

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Inteligência financeira</p>
          <h1 className="mt-1 text-3xl font-bold text-foreground">Dashboard de gastos</h1>
          <p className="mt-2 text-muted-foreground">Entradas, gastos, contrapartes e qualidade dos extratos processados pelo GENUS-APP.</p>
        </div>
        {clientesCount > 0 && <UploadExtratoDialog clientes={clientes} defaultClienteId={filters.clienteId} />}
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overview.map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={20} aria-hidden="true" /></div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{label}</p>
          </article>
        ))}
      </section>

      {clientesCount === 0 ? (
        <section className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div><h2 className="text-lg font-bold text-foreground">Comece por um cliente</h2><p className="mt-1 text-sm text-muted-foreground">Cadastre o cliente antes de importar os extratos bancários.</p></div>
            <Button nativeButton={false} render={<Link href="/clientes" />}>Ir para Clientes <ArrowUpRight size={17} /></Button>
          </div>
        </section>
      ) : (
        <div className="mt-8"><DashboardFilters clientes={clientes} values={{ clienteId: filters.clienteId, inicio: dashboard.periodStart, fim: dashboard.periodEnd }} /></div>
      )}

      {!dashboard.hasData ? (
        <div className="mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <FileText size={30} className="text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Nenhum extrato encontrado {clienteSelecionado ? `para ${clienteSelecionado.nome}` : ""}.</p>
          <p className="text-xs text-muted-foreground">Importe um PDF bancário para gerar a análise de gastos.</p>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-sm font-medium text-primary">Período analisado</p><h2 className="mt-1 text-xl font-bold text-foreground">{dashboard.periodLabel}</h2><p className="text-xs text-muted-foreground">Escopo: {escopoLabel}</p></div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="border-emerald-600/30 bg-emerald-600/10 text-emerald-700"><BadgeCheck size={14} /> {dashboard.quality.reconciled} conciliado(s)</Badge>
              {dashboard.quality.divergent > 0 && <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive"><CircleAlert size={14} /> {dashboard.quality.divergent} divergente(s)</Badge>}
              {dashboard.quality.unavailable > 0 && <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700"><FileQuestion size={14} /> {dashboard.quality.unavailable} sem conciliação</Badge>}
            </div>
          </div>

          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StatTile label="Entradas no período" value={formatCurrency(dashboard.totalEntradas)} sparkline={dashboard.spendingTrend.map((item) => item.entradas)} />
            <StatTile label="Gastos no período" value={formatCurrency(dashboard.totalSaidas)} sparkline={dashboard.spendingTrend.map((item) => item.saidas)} />
            <StatTile label="Resultado líquido" value={formatCurrency(dashboard.resultado)} />
            <StatTile label="Média por gasto" value={formatCurrency(dashboard.mediaGasto)} />
            <StatTile label="Maior gasto" value={formatCurrency(dashboard.maiorGasto)} />
            <StatTile label="Tarifas identificadas" value={formatCurrency(dashboard.totalTarifas)} />
          </section>

          {!dashboard.hasTransactions ? (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-amber-800">Há extratos cadastrados, mas nenhuma movimentação no período selecionado.</div>
          ) : (
            <>
              <section className="mt-4"><SpendingTrendChart data={dashboard.spendingTrend} subtitle={`Movimentação diária ou mensal · ${escopoLabel}`} /></section>
              <section className="mt-4 grid gap-4 lg:grid-cols-2">
                <CategoryBreakdownChart data={dashboard.categorySpend} subtitle={`${dashboard.saidasCount} gastos classificados no período`} />
                <CategoryBreakdownChart data={dashboard.counterpartySpend} title="Maiores destinatários" subtitle="Contrapartes que mais receberam recursos" />
              </section>
              <section className="mt-4 grid gap-4 lg:grid-cols-2">
                <CategoryBreakdownChart data={dashboard.bankSpend} title="Gastos por banco" subtitle="Saídas agrupadas pela instituição do extrato" />
                {dashboard.bankAccounts.length > 0 ? <AccountBalanceChart data={dashboard.bankAccounts} subtitle={`Último saldo disponível · ${escopoLabel}`} /> : <article className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-6 text-center"><ReceiptText className="text-muted-foreground" /><p className="mt-3 text-sm font-medium text-foreground">Os extratos deste escopo não informaram saldo final.</p></article>}
              </section>
              <section className="mt-4"><RecentTransactions data={dashboard.recentTransactions} subtitle={`Movimentações mais recentes do período · ${escopoLabel}`} /></section>
            </>
          )}
        </>
      )}
    </main>
  );
}
