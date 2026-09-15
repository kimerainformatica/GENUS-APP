// Tipos e formatação compartilhados pelos gráficos do dashboard de extrato
// bancário. Os dados em si vêm de src/lib/dashboard-data.ts, calculados a
// partir dos Extratos/Transações reais no banco (importados via GENUS-APP).

export type BankAccount = {
  bank: string;
  accountMasked: string;
  balance: number;
};

export type AccountFlow = {
  label: string;
  saldo: number;
  entradas: number;
  saidas: number;
};

export type CategorySpend = {
  category: string;
  value: number;
};

export type Transaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  bank?: string;
  clienteId: string;
  clienteNome: string;
  extratoId: string;
  type: "entrada" | "saida";
  value: number;
};

export type SpendingTrendPoint = {
  key: string;
  label: string;
  entradas: number;
  saidas: number;
};

export { formatCurrency } from "@/lib/money";
