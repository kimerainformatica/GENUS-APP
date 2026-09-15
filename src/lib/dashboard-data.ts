import "server-only";

import { requireSession } from "@/lib/auth/session";
import { sumMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import type { BankAccount, CategorySpend, SpendingTrendPoint, Transaction } from "@/lib/mock-bank-data";

export type DashboardFilters = { clienteId?: string; inicio?: string; fim?: string };

export type DashboardData = {
  hasData: boolean;
  hasTransactions: boolean;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  bankAccounts: BankAccount[];
  spendingTrend: SpendingTrendPoint[];
  categorySpend: CategorySpend[];
  bankSpend: CategorySpend[];
  counterpartySpend: CategorySpend[];
  recentTransactions: Transaction[];
  currentBalance: number;
  totalEntradas: number;
  totalSaidas: number;
  resultado: number;
  totalTarifas: number;
  mediaGasto: number;
  maiorGasto: number;
  saidasCount: number;
  quality: { imported: number; reconciled: number; divergent: number; unavailable: number };
};

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || isoDate(date) !== value ? null : date;
}

function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function monthEnd(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function shortDate(date: Date): string {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

function labelPeriod(start: Date, end: Date): string {
  return `${start.toLocaleDateString("pt-BR", { timeZone: "UTC" })} a ${end.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`;
}

function ranked(map: Map<string, number>, limit: number): CategorySpend[] {
  return [...map.entries()]
    .map(([category, value]) => ({ category, value: sumMoney([value]) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export async function getDashboardData(filters: DashboardFilters): Promise<DashboardData> {
  await requireSession();
  const extratoWhere = filters.clienteId ? { clienteId: filters.clienteId } : {};
  const [extratos, latestTransaction] = await Promise.all([
    prisma.extrato.findMany({
      where: extratoWhere,
      select: {
        id: true,
        clienteId: true,
        instituicao: true,
        agencia: true,
        conta: true,
        periodoInicio: true,
        periodoFim: true,
        saldoFinal: true,
        createdAt: true,
        origem: true,
        reconciliacaoOk: true,
        cliente: { select: { nome: true } },
      },
      orderBy: [{ periodoFim: "desc" }, { createdAt: "desc" }],
    }),
    prisma.transacao.findFirst({
      where: { extrato: extratoWhere },
      orderBy: { data: "desc" },
      select: { data: true },
    }),
  ]);

  const anchor = latestTransaction?.data ?? new Date();
  let start = parseIsoDate(filters.inicio) ?? monthStart(anchor);
  let end = parseIsoDate(filters.fim) ?? monthEnd(anchor);
  if (start > end) [start, end] = [monthStart(anchor), monthEnd(anchor)];

  const transacoes = await prisma.transacao.findMany({
    where: { data: { gte: start, lte: end }, extrato: extratoWhere },
    select: {
      id: true,
      data: true,
      categoria: true,
      tipo: true,
      descricao: true,
      nomeContraparte: true,
      tarifaTaxa: true,
      valor: true,
      createdAt: true,
      extrato: {
        select: {
          id: true,
          instituicao: true,
          cliente: { select: { id: true, nome: true } },
        },
      },
    },
    orderBy: [{ data: "desc" }, { createdAt: "desc" }],
  });

  const multipleClients = !filters.clienteId && new Set(extratos.map((item) => item.clienteId)).size > 1;
  const latestByAccount = new Map<string, (typeof extratos)[number]>();
  for (const extrato of extratos) {
    const key = `${extrato.clienteId}|${extrato.instituicao ?? "Banco"}|${extrato.agencia ?? ""}|${extrato.conta ?? ""}`;
    const current = latestByAccount.get(key);
    if (!current || (extrato.periodoFim ?? extrato.createdAt) > (current.periodoFim ?? current.createdAt)) latestByAccount.set(key, extrato);
  }
  const bankAccounts = [...latestByAccount.values()].filter((item) => item.saldoFinal !== null).map((item) => ({
    bank: multipleClients ? `${item.instituicao ?? "Banco"} · ${item.cliente.nome}` : item.instituicao ?? "Banco",
    accountMasked: item.agencia || item.conta ? `${item.agencia ?? "—"} / ${item.conta ?? "—"}` : `posição em ${shortDate(item.periodoFim ?? item.createdAt)}`,
    balance: item.saldoFinal as number,
  }));

  const entradas = transacoes.filter((item) => item.valor >= 0).map((item) => item.valor);
  const saidas = transacoes.filter((item) => item.valor < 0);
  const totalEntradas = sumMoney(entradas);
  const totalSaidas = sumMoney(saidas.map((item) => Math.abs(item.valor)));
  const totalTarifas = sumMoney(transacoes.map((item) => Math.abs(item.tarifaTaxa ?? 0)));
  const maiorGasto = saidas.reduce((max, item) => Math.max(max, Math.abs(item.valor)), 0);

  const categoryMap = new Map<string, number>();
  const bankMap = new Map<string, number>();
  const counterpartyMap = new Map<string, number>();
  for (const transaction of saidas) {
    const value = Math.abs(transaction.valor);
    const category = transaction.categoria || "Outros";
    const bank = transaction.extrato.instituicao || "Banco não identificado";
    const counterparty = transaction.nomeContraparte || transaction.descricao || "Não identificada";
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + value);
    bankMap.set(bank, (bankMap.get(bank) ?? 0) + value);
    counterpartyMap.set(counterparty, (counterpartyMap.get(counterparty) ?? 0) + value);
  }

  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const groupMonthly = days > 62;
  const trendMap = new Map<string, { entradas: number[]; saidas: number[] }>();
  for (const transaction of transacoes) {
    const key = groupMonthly ? isoDate(transaction.data).slice(0, 7) : isoDate(transaction.data);
    const bucket = trendMap.get(key) ?? { entradas: [], saidas: [] };
    if (transaction.valor >= 0) bucket.entradas.push(transaction.valor);
    else bucket.saidas.push(Math.abs(transaction.valor));
    trendMap.set(key, bucket);
  }
  const spendingTrend: SpendingTrendPoint[] = [...trendMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, values]) => ({
    key,
    label: groupMonthly ? new Date(`${key}-01T00:00:00.000Z`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }) : shortDate(new Date(`${key}T00:00:00.000Z`)),
    entradas: sumMoney(values.entradas),
    saidas: sumMoney(values.saidas),
  }));

  const relevantExtratos = extratos.filter((item) => {
    const itemStart = item.periodoInicio ?? item.createdAt;
    const itemEnd = item.periodoFim ?? item.createdAt;
    return itemStart <= end && itemEnd >= start;
  });
  const imported = relevantExtratos.filter((item) => item.origem === "IMPORTADO");
  const quality = {
    imported: imported.length,
    reconciled: imported.filter((item) => item.reconciliacaoOk === true).length,
    divergent: imported.filter((item) => item.reconciliacaoOk === false).length,
    unavailable: imported.filter((item) => item.reconciliacaoOk === null).length,
  };

  return {
    hasData: extratos.length > 0,
    hasTransactions: transacoes.length > 0,
    periodStart: isoDate(start),
    periodEnd: isoDate(end),
    periodLabel: labelPeriod(start, end),
    bankAccounts,
    spendingTrend,
    categorySpend: ranked(categoryMap, 8),
    bankSpend: ranked(bankMap, 8),
    counterpartySpend: ranked(counterpartyMap, 10),
    recentTransactions: transacoes.slice(0, 12).map((item) => ({
      id: item.id,
      date: shortDate(item.data),
      description: item.nomeContraparte || item.descricao,
      category: item.categoria || item.tipo,
      bank: item.extrato.instituicao ?? undefined,
      clienteId: item.extrato.cliente.id,
      clienteNome: item.extrato.cliente.nome,
      extratoId: item.extrato.id,
      type: item.valor >= 0 ? "entrada" : "saida",
      value: Math.abs(item.valor),
    })),
    currentBalance: sumMoney(bankAccounts.map((account) => account.balance)),
    totalEntradas,
    totalSaidas,
    resultado: sumMoney([totalEntradas, -totalSaidas]),
    totalTarifas,
    mediaGasto: saidas.length ? sumMoney([totalSaidas / saidas.length]) : 0,
    maiorGasto,
    saidasCount: saidas.length,
    quality,
  };
}
