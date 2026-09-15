"use client";

import { useState } from "react";
import { ChartCard, DataTable } from "./chart-card";
import { diverging, ink } from "./palette";
import { formatCurrency, type AccountFlow } from "@/lib/mock-bank-data";

const WIDTH = 560;
const HEIGHT = 240;
const PAD = { top: 8, right: 16, bottom: 28, left: 16 };
const BAR_MAX = 24;

export function CashFlowChart({
  data,
  subtitle = "Total do período de cada extrato",
}: {
  data: AccountFlow[];
  subtitle?: string;
}) {
  const [hover, setHover] = useState<{ i: number; type: "entrada" | "saida" } | null>(null);

  const maxValue = Math.max(...data.flatMap((d) => [d.entradas, d.saidas]));
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const zeroY = PAD.top + plotH / 2;
  const halfH = plotH / 2;

  const slot = plotW / data.length;
  const barW = Math.min(BAR_MAX, slot * 0.32);
  const gap = 2;

  const scale = (v: number) => (v / maxValue) * (halfH - 8);

  return (
    <ChartCard
      title="Entradas x Saídas"
      subtitle={subtitle}
      legend={[
        { label: "Entradas", color: diverging.positive },
        { label: "Saídas", color: diverging.negative },
      ]}
      table={
        <DataTable
          columns={["Conta", "Entradas", "Saídas"]}
          rows={data.map((d) => [d.label, formatCurrency(d.entradas), formatCurrency(d.saidas)])}
        />
      }
    >
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Entradas e saídas de cada conta bancária, em reais"
          onPointerLeave={() => setHover(null)}
        >
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={zeroY} y2={zeroY} stroke={ink.baseline} strokeWidth={1} />

          {data.map((d, i) => {
            const cx = PAD.left + slot * i + slot / 2;
            const inH = scale(d.entradas);
            const outH = scale(d.saidas);
            const isEntradaHover = hover?.i === i && hover.type === "entrada";
            const isSaidaHover = hover?.i === i && hover.type === "saida";

            return (
              <g key={`${d.label}-${i}`}>
                <rect
                  x={cx - barW / 2}
                  y={zeroY - inH - gap}
                  width={barW}
                  height={inH}
                  rx={4}
                  fill={diverging.positive}
                  opacity={isEntradaHover ? 1 : 0.9}
                />
                <rect
                  x={cx - barW / 2}
                  y={zeroY + gap}
                  width={barW}
                  height={outH}
                  rx={4}
                  fill={diverging.negative}
                  opacity={isSaidaHover ? 1 : 0.9}
                />

                <rect
                  x={cx - slot / 2}
                  y={PAD.top}
                  width={slot / 2}
                  height={halfH}
                  fill="transparent"
                  onPointerEnter={() => setHover({ i, type: "entrada" })}
                  className="cursor-pointer"
                />
                <rect
                  x={cx - slot / 2}
                  y={zeroY}
                  width={slot / 2}
                  height={halfH}
                  fill="transparent"
                  onPointerEnter={() => setHover({ i, type: "saida" })}
                  className="cursor-pointer"
                />
                <rect
                  x={cx}
                  y={PAD.top}
                  width={slot / 2}
                  height={halfH}
                  fill="transparent"
                  onPointerEnter={() => setHover({ i, type: "entrada" })}
                  className="cursor-pointer"
                />
                <rect
                  x={cx}
                  y={zeroY}
                  width={slot / 2}
                  height={halfH}
                  fill="transparent"
                  onPointerEnter={() => setHover({ i, type: "saida" })}
                  className="cursor-pointer"
                />

                <text x={cx} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={ink.secondary}>
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: `${((PAD.left + slot * hover.i + slot / 2) / WIDTH) * 100}%` }}
          >
            <p className="flex items-center gap-1.5 text-slate-500">
              <span
                className="h-1.5 w-2.5 rounded-full"
                style={{ backgroundColor: hover.type === "entrada" ? diverging.positive : diverging.negative }}
              />
              {data[hover.i].label} · {hover.type === "entrada" ? "Entradas" : "Saídas"}
            </p>
            <p className="font-semibold text-[#1E2559]">
              {formatCurrency(hover.type === "entrada" ? data[hover.i].entradas : data[hover.i].saidas)}
            </p>
          </div>
        )}
      </div>
    </ChartCard>
  );
}
