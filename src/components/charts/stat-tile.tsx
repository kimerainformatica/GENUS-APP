import { categorical, ink } from "./palette";

export function StatTile({
  label,
  value,
  delta,
  deltaGood,
  sparkline,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaGood?: boolean;
  sparkline?: number[];
}) {
  return (
    <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {delta && (
            <p className={`mt-1 text-xs font-medium ${deltaGood ? "text-primary" : "text-destructive"}`}>
              {delta} vs. mês anterior
            </p>
          )}
        </div>
        {sparkline && sparkline.length > 0 && <Sparkline values={sparkline} />}
      </div>
    </article>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const w = 72;
  const h = 28;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const lastX = values.length === 1 ? w / 2 : w;
  const lastY = h - ((values[values.length - 1] - min) / range) * h;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <polyline points={points.join(" ")} fill="none" stroke={categorical.blue} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" opacity={0.55} />
      <circle cx={lastX} cy={lastY} r={2.5} fill={categorical.blue} stroke={ink.surface} strokeWidth={1} />
    </svg>
  );
}
