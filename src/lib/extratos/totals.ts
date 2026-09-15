import "server-only";

import type { Prisma } from "../../../generated/prisma/client";
import { sumMoney } from "@/lib/money";

export async function recalculateExtratoTotals(tx: Prisma.TransactionClient, extratoId: string): Promise<void> {
  const rows = await tx.transacao.findMany({ where: { extratoId }, select: { valor: true } });
  const totalEntradas = sumMoney(rows.filter((row) => row.valor >= 0).map((row) => row.valor));
  const totalSaidas = sumMoney(rows.filter((row) => row.valor < 0).map((row) => Math.abs(row.valor)));
  await tx.extrato.update({ where: { id: extratoId }, data: { totalEntradas, totalSaidas } });
}
