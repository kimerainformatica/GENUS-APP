"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { EXPENSE_CATEGORIES } from "@/lib/extratos/categories";
import { recalculateExtratoTotals } from "@/lib/extratos/totals";
import { prisma } from "@/lib/prisma";
import { dateField, idField, moneyField, optionalIdField, textField } from "@/lib/validation";

function revalidateFinancialPaths(extratoId?: string, clienteIds: string[] = []): void {
  revalidatePath("/dashboard");
  revalidatePath("/extratos");
  if (extratoId) revalidatePath(`/extratos/${extratoId}`);
  for (const clienteId of new Set(clienteIds)) revalidatePath(`/clientes/${clienteId}`);
}

export async function saveExtrato(formData: FormData) {
  await requireSession();
  const id = optionalIdField(formData.get("id"));
  const clienteId = idField(formData.get("clienteId"), "Cliente");
  const periodoInicio = dateField(formData.get("periodoInicio"), "Data inicial");
  const periodoFim = dateField(formData.get("periodoFim"), "Data final");
  if (periodoInicio && periodoFim && periodoInicio > periodoFim) throw new Error("A data inicial deve ser anterior à data final.");

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
  if (!cliente) throw new Error("Cliente não encontrado.");

  const data = {
    clienteId,
    instituicao: textField(formData.get("instituicao"), "Banco", { max: 100 }),
    agencia: textField(formData.get("agencia"), "Agência", { max: 30 }),
    conta: textField(formData.get("conta"), "Conta", { max: 40 }),
    periodoInicio,
    periodoFim,
    saldoInicial: moneyField(formData.get("saldoInicial"), "Saldo inicial"),
    saldoFinal: moneyField(formData.get("saldoFinal"), "Saldo final"),
    totalEntradas: moneyField(formData.get("totalEntradas"), "Total de entradas"),
    totalSaidas: moneyField(formData.get("totalSaidas"), "Total de saídas"),
  };

  let extratoId: string;
  const affectedClienteIds = [clienteId];
  if (id) {
    const existing = await prisma.extrato.findUnique({ where: { id }, select: { id: true, clienteId: true } });
    if (!existing) throw new Error("Extrato não encontrado.");
    affectedClienteIds.push(existing.clienteId);
    await prisma.extrato.update({ where: { id }, data });
    extratoId = id;
  } else {
    const created = await prisma.extrato.create({ data: { ...data, origem: "MANUAL" }, select: { id: true } });
    extratoId = created.id;
  }

  revalidateFinancialPaths(extratoId, affectedClienteIds);
  return { id: extratoId, created: !id };
}

export async function deleteExtrato(id: string) {
  await requireSession();
  const safeId = optionalIdField(id);
  if (!safeId) throw new Error("Extrato inválido.");
  const existing = await prisma.extrato.findUnique({ where: { id: safeId }, select: { id: true, clienteId: true } });
  if (!existing) throw new Error("Extrato não encontrado.");
  await prisma.extrato.delete({ where: { id: safeId } });
  revalidateFinancialPaths(undefined, [existing.clienteId]);
  redirect("/extratos");
}

export async function saveTransacao(formData: FormData) {
  await requireSession();
  const id = optionalIdField(formData.get("id"));
  const extratoId = idField(formData.get("extratoId"), "Extrato");
  const descricao = textField(formData.get("descricao"), "Descrição", { required: true, max: 500 }) as string;
  const valor = moneyField(formData.get("valor"), "Valor", true) as number;
  const data = dateField(formData.get("data"), "Data", true) as Date;
  const categoriaInput = textField(formData.get("categoria"), "Categoria", { max: 80 }) ?? "Outros";
  const categoria = EXPENSE_CATEGORIES.includes(categoriaInput as (typeof EXPENSE_CATEGORIES)[number]) ? categoriaInput : "Outros";
  const payload = {
    data,
    tipo: textField(formData.get("tipo"), "Tipo", { max: 80 }) ?? "Não classificado",
    categoria,
    descricao,
    identificador: textField(formData.get("identificador"), "ID da operação", { max: 160 }),
    nomeContraparte: textField(formData.get("nomeContraparte"), "Contraparte", { max: 500 }) ?? descricao,
    valor,
    valorBruto: moneyField(formData.get("valorBruto"), "Valor bruto") ?? Math.abs(valor),
    tarifaTaxa: moneyField(formData.get("tarifaTaxa"), "Tarifa/taxa") ?? 0,
    saldoApos: moneyField(formData.get("saldoApos"), "Saldo após"),
  };

  let clienteId = "";
  await prisma.$transaction(async (tx) => {
    const extrato = await tx.extrato.findUnique({ where: { id: extratoId }, select: { id: true, clienteId: true } });
    if (!extrato) throw new Error("Extrato não encontrado.");
    clienteId = extrato.clienteId;
    if (id) {
      const existing = await tx.transacao.findFirst({ where: { id, extratoId }, select: { id: true } });
      if (!existing) throw new Error("Lançamento não encontrado neste extrato.");
      await tx.transacao.update({ where: { id }, data: payload });
    } else {
      await tx.transacao.create({ data: { ...payload, extratoId } });
    }
    await recalculateExtratoTotals(tx, extratoId);
  });

  revalidateFinancialPaths(extratoId, [clienteId]);
  return { success: true };
}

export async function deleteTransacao(id: string, extratoId: string) {
  await requireSession();
  const safeId = optionalIdField(id);
  const safeExtratoId = optionalIdField(extratoId);
  if (!safeId || !safeExtratoId) throw new Error("Lançamento inválido.");

  let clienteId = "";
  await prisma.$transaction(async (tx) => {
    const existing = await tx.transacao.findFirst({ where: { id: safeId, extratoId: safeExtratoId }, select: { id: true, extrato: { select: { clienteId: true } } } });
    if (!existing) throw new Error("Lançamento não encontrado neste extrato.");
    clienteId = existing.extrato.clienteId;
    await tx.transacao.delete({ where: { id: safeId } });
    await recalculateExtratoTotals(tx, safeExtratoId);
  });
  revalidateFinancialPaths(safeExtratoId, [clienteId]);
}
