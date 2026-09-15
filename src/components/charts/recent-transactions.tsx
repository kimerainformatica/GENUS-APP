import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Building2, ChevronRight } from "lucide-react";
import { formatCurrency, type Transaction } from "@/lib/mock-bank-data";

export function RecentTransactions({
  data,
  subtitle = "Lançamentos mais recentes",
}: {
  data: Transaction[];
  subtitle?: string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-foreground">Últimas movimentações</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <ul className="divide-y divide-border/60">
        {data.map((t) => (
          <li key={t.id} className="first:-mt-1 last:-mb-1">
            <Link
              href={`/clientes/${t.clienteId}`}
              aria-label={`Ver perfil de ${t.clienteNome}`}
              className="group flex items-center gap-3 rounded-xl py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span
                className={`ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  t.type === "entrada" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                }`}
                aria-hidden="true"
              >
                {t.type === "entrada" ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">{t.description}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
                    <Building2 size={11} aria-hidden="true" />
                    <span className="truncate">{t.clienteNome}</span>
                  </span>
                  <span>{t.date} · {t.category}{t.bank ? ` · ${t.bank}` : ""}</span>
                </div>
              </div>
              <span
                className={`shrink-0 text-sm font-semibold [font-variant-numeric:tabular-nums] ${
                  t.type === "entrada" ? "text-primary" : "text-foreground"
                }`}
              >
                {t.type === "entrada" ? "+" : "-"}
                {formatCurrency(t.value)}
              </span>
              <ChevronRight size={16} className="mr-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}
