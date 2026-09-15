"use client";

import { useState } from "react";
import { TableProperties } from "lucide-react";

export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  legend?: { label: string; color: string }[];
  table?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {table && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            aria-pressed={showTable}
          >
            <TableProperties size={13} aria-hidden="true" />
            {showTable ? "Ver gráfico" : "Ver dados"}
          </button>
        )}
      </div>

      {legend && legend.length > 1 && !showTable && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {legend.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              {item.label}
            </div>
          ))}
        </div>
      )}

      {showTable && table ? table : children}
    </article>
  );
}

export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {columns.map((col) => (
              <th key={col} className="py-2 pr-4 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[font-variant-numeric:tabular-nums]">
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/60 last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-4 text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
