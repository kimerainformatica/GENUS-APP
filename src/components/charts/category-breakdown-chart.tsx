"use client";

import { useState } from "react";
import { ChartCard, DataTable } from "./chart-card";
import { categoryOrder, ink } from "./palette";
import { formatCurrency, type CategorySpend } from "@/lib/mock-bank-data";

export function CategoryBreakdownChart({
  data,
  title = "Gastos por categoria",
  subtitle = "Saídas classificadas por tipo de lançamento",
}: {
  data: CategorySpend[];
  title?: string;
  subtitle?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map((d) => d.value), 1);
  const total = sorted.reduce((sum, d) => sum + d.value, 0) || 1;

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      table={
        <DataTable
          columns={["Categoria", "Valor", "% do total"]}
          rows={sorted.map((d) => [d.category, formatCurrency(d.value), `${((d.value / total) * 100).toFixed(1)}%`])}
        />
      }
    >
      {sorted.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nenhum gasto nesta dimensão.</p>
      ) : <div className="flex flex-col gap-3">
        {sorted.map((d, i) => {
          const pct = (d.value / max) * 100;
          const color = categoryOrder[i % categoryOrder.length];
          return (
            <div
              key={d.category}
              className="group cursor-pointer"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                  <span className="truncate" title={d.category}>{d.category}</span>
                </span>
                <span
                  className="font-semibold [font-variant-numeric:tabular-nums]"
                  style={{ color: hover === i ? ink.primary : ink.secondary }}
                >
                  {formatCurrency(d.value)}
                </span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-opacity"
                  style={{ width: `${pct}%`, backgroundColor: color, opacity: hover === null || hover === i ? 1 : 0.55 }}
                />
              </div>
            </div>
          );
        })}
      </div>}
    </ChartCard>
  );
}
