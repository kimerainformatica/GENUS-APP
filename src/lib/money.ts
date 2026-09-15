export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sumMoney(values: number[]): number {
  const cents = values.reduce((sum, value) => sum + Math.round(value * 100), 0);
  return cents / 100;
}

export function formatCurrency(value: number, maximumFractionDigits = 2): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
}
