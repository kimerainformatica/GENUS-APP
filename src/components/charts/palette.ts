// Paleta validada (ver skill dataviz / references/palette.md).
// Ordem categórica é o mecanismo de segurança para daltonismo — nunca reordenar
// ou gerar tons novos; ao passar de 5 séries, agrupe em "Outros".

export const categorical = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  yellow: "#eda100",
  magenta: "#e87ba4",
} as const;

export const diverging = {
  positive: "#2a78d6", // entradas
  negative: "#e34948", // saídas
  midpoint: "#f0efec",
} as const;

export const ink = {
  primary: "#1E2559",
  secondary: "#52514e",
  muted: "#94a3b8", // slate-400, alinhado ao restante do dashboard
  grid: "#e2e8f0", // slate-200
  baseline: "#cbd5e1", // slate-300
  surface: "#ffffff",
} as const;

export const categoryOrder = [
  categorical.blue,
  categorical.orange,
  categorical.aqua,
  categorical.yellow,
  categorical.magenta,
];
