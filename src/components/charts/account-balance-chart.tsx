"use client";

import { useState } from "react";
import { ChartCard, DataTable } from "./chart-card";
import { diverging, ink } from "./palette";
import { formatCurrency, type BankAccount } from "@/lib/mock-bank-data";

const WIDTH = 560;
const ROW_H = 40;
const PAD = { top: 8, right: 16, bottom: 8, left: 118 };
const NEG_ZONE = 46;

export function AccountBalanceChart({
  data,
  subtitle = "Saldo mais recente de cada conta",
}: {
  data: BankAccount[];
  subtitle?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const sorted = [...data].sort((a, b) => b.balance - a.balance);
  const height = PAD.top + PAD.bottom + sorted.length * ROW_H;

  const zeroX = PAD.left + NEG_ZONE;
  // Reserve room on the right so the direct label of the longest bar never gets clipped.
  const LABEL_RESERVE = 92;
  const posZoneWidth = WIDTH - zeroX - PAD.right - LABEL_RESERVE;
  const maxPositive = Math.max(...sorted.map((d) => (d.balance > 0 ? d.balance : 0)), 1);
  const maxNegativeAbs = Math.max(...sorted.map((d) => (d.balance < 0 ? Math.abs(d.balance) : 0)), 1);

  const active = hover !== null ? sorted[hover] : null;

  return (
    <ChartCard
      title="Saldo por conta bancária"
      subtitle={subtitle}
      legend={[
        { label: "Saldo positivo", color: diverging.positive },
        { label: "Saldo negativo", color: diverging.negative },
      ]}
      table={
        <DataTable
          columns={["Conta", "Saldo"]}
          rows={sorted.map((d) => [`${d.bank} ${d.accountMasked}`, formatCurrency(d.balance)])}
        />
      }
    >
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" role="img" aria-label="Saldo atual de cada conta bancária">
          <line x1={zeroX} x2={zeroX} y1={PAD.top} y2={height - PAD.bottom} stroke={ink.baseline} strokeWidth={1} />

          {sorted.map((d, i) => {
            const cy = PAD.top + i * ROW_H + ROW_H / 2;
            const isPositive = d.balance >= 0;
            const barW = isPositive
              ? (d.balance / maxPositive) * posZoneWidth
              : (Math.abs(d.balance) / maxNegativeAbs) * NEG_ZONE;
            const barX = isPositive ? zeroX : zeroX - barW;
            const isHovered = hover === i;

            return (
              <g key={`${d.bank}-${d.accountMasked}-${i}`}>
                <text x={PAD.left - 10} y={cy + 4} textAnchor="end" fontSize={12} fontWeight={600} fill={ink.primary}>
                  {d.bank}
                </text>
                <rect
                  x={barX}
                  y={cy - 9}
                  width={Math.max(barW, 2)}
                  height={18}
                  rx={4}
                  fill={isPositive ? diverging.positive : diverging.negative}
                  opacity={isHovered ? 1 : 0.9}
                />
                <text
                  x={isPositive ? barX + barW + 8 : zeroX + 8}
                  y={cy + 4}
                  textAnchor="start"
                  fontSize={11}
                  fontWeight={600}
                  fill={ink.secondary}
                >
                  {formatCurrency(d.balance)}
                </text>
                <rect
                  x={PAD.left}
                  y={cy - ROW_H / 2}
                  width={WIDTH - PAD.left - PAD.right}
                  height={ROW_H}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  className="cursor-pointer"
                />
              </g>
            );
          })}
        </svg>

        {active && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: `${(zeroX / WIDTH) * 100}%`, top: `${((PAD.top + (hover as number) * ROW_H) / height) * 100}%` }}
          >
            <p className="text-muted-foreground">{active.bank}</p>
            <p className="font-semibold text-foreground">{formatCurrency(active.balance)}</p>
          </div>
        )}
      </div>
    </ChartCard>
  );
}
