import { roundMoney } from "@/lib/money";

// Entrada bruta com margem: projeta o valor de entrada acrescido da margem do
// cliente (markup), ex.: R$1.000 com 20% de margem = R$1.200.
export function valorBrutoComMargem(valor: number, margemPercentual: number | null): number | null {
  if (margemPercentual === null) return null;
  return roundMoney(valor * (1 + margemPercentual / 100));
}

// Saldo líquido com margem: projeta o saldo já descontada a margem do
// cliente, ex.: R$1.000 com 20% de margem = R$800.
export function valorLiquidoComMargem(valor: number, margemPercentual: number | null): number | null {
  if (margemPercentual === null) return null;
  return roundMoney(valor * (1 - margemPercentual / 100));
}
