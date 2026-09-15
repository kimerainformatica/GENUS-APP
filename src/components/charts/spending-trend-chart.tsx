"use client";

import { useState } from "react";
import { ChartCard, DataTable } from "./chart-card";
import { diverging, ink } from "./palette";
import { formatCurrency, type SpendingTrendPoint } from "@/lib/mock-bank-data";

const WIDTH = 720;
const HEIGHT = 260;
const PAD = { top: 16, right: 18, bottom: 34, left: 18 };

export function SpendingTrendChart({ data, subtitle }: { data: SpendingTrendPoint[]; subtitle: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((item) => [item.entradas, item.saidas]));
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (data.length <= 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const y = (value: number) => PAD.top + plotHeight - (value / max) * plotHeight;
  const points = (field: "entradas" | "saidas") => data.map((item, index) => `${x(index)},${y(item[field])}`).join(" ");
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));
  const active = hover === null ? null : data[hover];

  return (
    <ChartCard
      title="Evolução de entradas e gastos"
      subtitle={subtitle}
      legend={[{ label: "Entradas", color: diverging.positive }, { label: "Gastos", color: diverging.negative }]}
      table={<DataTable columns={["Período", "Entradas", "Gastos"]} rows={data.map((item) => [item.label, formatCurrency(item.entradas), formatCurrency(item.saidas)])} />}
    >
      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Evolução de entradas e gastos no período" onPointerLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((ratio) => <line key={ratio} x1={PAD.left} x2={WIDTH - PAD.right} y1={PAD.top + plotHeight * ratio} y2={PAD.top + plotHeight * ratio} stroke={ink.grid} strokeWidth={1} />)}
          {data.length > 1 && <polyline points={points("entradas")} fill="none" stroke={diverging.positive} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}
          {data.length > 1 && <polyline points={points("saidas")} fill="none" stroke={diverging.negative} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />}
          {data.map((item, index) => (
            <g key={item.key}>
              <circle cx={x(index)} cy={y(item.entradas)} r={hover === index ? 5 : 3} fill={diverging.positive} />
              <circle cx={x(index)} cy={y(item.saidas)} r={hover === index ? 5 : 3} fill={diverging.negative} />
              {(index % labelEvery === 0 || index === data.length - 1) && <text x={x(index)} y={HEIGHT - 10} textAnchor="middle" fontSize={11} fill={ink.secondary}>{item.label}</text>}
              <rect x={x(index) - Math.max(8, plotWidth / Math.max(data.length, 1) / 2)} y={PAD.top} width={Math.max(16, plotWidth / Math.max(data.length, 1))} height={plotHeight} fill="transparent" className="cursor-pointer" onPointerEnter={() => setHover(index)} />
            </g>
          ))}
        </svg>
        {active && <div className="pointer-events-none absolute top-2 -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md" style={{ left: `${(x(hover as number) / WIDTH) * 100}%` }}><p className="font-semibold text-foreground">{active.label}</p><p style={{ color: diverging.positive }}>Entradas: {formatCurrency(active.entradas)}</p><p style={{ color: diverging.negative }}>Gastos: {formatCurrency(active.saidas)}</p></div>}
      </div>
    </ChartCard>
  );
}
