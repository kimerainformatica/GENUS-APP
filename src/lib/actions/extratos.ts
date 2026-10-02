"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/auth/session";
import { EXPENSE_CATEGORIES } from "@/lib/extratos/categories";
import { recalculateExtratoTotals } from "@/lib/extratos/totals";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/user-facing-error";
import { dateField, idField, moneyField, optionalIdField, textField } from "@/lib/validation";

function revalidateFinancialPaths(extratoId?: string, clienteIds: string[] = []): void {
  revalidatePath("/dashboard");
  revalidatePath("/extratos");
  if (extratoId) revalidatePath(`/extratos/${extratoId}`);
  for (const clienteId of new Set(clienteIds)) revalidatePath(`/clientes/${clienteId}`);
}

function isUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function saveExtrato(formData: FormData): Promise<ActionResult<{ id: string; created: boolean }>> {
  return runAction(async () => {
    await requireSession();
    const id = optionalIdField(formData.get("id"));
    const clienteId = idField(formData.get("clienteId"), "Cliente");
    const periodoInicio = dateField(formData.get("periodoInicio"), "Data inicial");
    const periodoFim = dateField(formData.get("periodoFim"), "Data final");
    if (periodoInicio && periodoFim && periodoInicio > periodoFim) {
      throw new UserFacingError("A data inicial deve ser anterior à data final.");
    }

    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
    if (!cliente) throw new UserFacingError("Cliente não encontrado.");

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
    try {
      if (id) {
        const existing = await prisma.extrato.findUnique({ where: { id }, select: { id: true, clienteId: true } });
        if (!existing) throw new UserFacingError("Extrato não encontrado.");
        affectedClienteIds.push(existing.clienteId);
        await prisma.extrato.update({ where: { id }, data });
        extratoId = id;
      } else {
        const created = await prisma.extrato.create({ data: { ...data, origem: "MANUAL" }, select: { id: true } });
        extratoId = created.id;
      }
    } catch (error) {
      // Trocar o cliente de um extrato importado colide se o cliente novo já
      // tem o mesmo PDF (único por cliente + hash do arquivo).
      if (isUniqueError(error)) throw new UserFacingError("O cliente escolhido já tem este mesmo PDF importado.");
      throw error;
    }

    revalidateFinancialPaths(extratoId, affectedClienteIds);
    return { id: extratoId, created: !id };
  });
}

/** Exclui o extrato e seus lançamentos. Quem chama navega para /extratos ao receber sucesso. */
export async function deleteExtrato(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const safeId = optionalIdField(id);
    if (!safeId) throw new UserFacingError("Extrato inválido.");
    const existing = await prisma.extrato.findUnique({ where: { id: safeId }, select: { id: true, clienteId: true } });
    if (!existing) throw new UserFacingError("Extrato não encontrado.");
    await prisma.extrato.delete({ where: { id: safeId } });
    revalidateFinancialPaths(undefined, [existing.clienteId]);
    return {};
  });
}

export async function saveTransacao(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const id = optionalIdField(formData.get("id"));
    const extratoId = idField(formData.get("extratoId"), "Extrato");
    const descricao = textField(formData.get("descricao"), "Descrição", { required: true, max: 500 }) as string;
    const valor = moneyField(formData.get("valor"), "Valor", true) as number;
    const data = dateField(formData.get("data"), "Data", true) as Date;
    const categoriaInput = textField(formData.get("categoria"), "Categoria", { max: 80 }) ?? "Outros";
    const categoria = EXPENSE_CATEGORIES.includes(categoriaInput as (typeof EXPENSE_CATEGORIES)[number]) ? categoriaInput : "Outros";
    const tarifaTaxa = moneyField(formData.get("tarifaTaxa"), "Tarifa/taxa") ?? 0;
    if (tarifaTaxa < 0) throw new UserFacingError("A tarifa/taxa não pode ser negativa.");
    const payload = {
      data,
      tipo: textField(formData.get("tipo"), "Tipo", { max: 80 }) ?? "Não classificado",
      categoria,
      descricao,
      identificador: textField(formData.get("identificador"), "ID da operação", { max: 160 }),
      nomeContraparte: textField(formData.get("nomeContraparte"), "Contraparte", { max: 500 }) ?? descricao,
      valor,
      valorBruto: moneyField(formData.get("valorBruto"), "Valor bruto") ?? Math.abs(valor),
      tarifaTaxa,
      saldoApos: moneyField(formData.get("saldoApos"), "Saldo após"),
    };

    let clienteId = "";
    await prisma.$transaction(async (tx) => {
      const extrato = await tx.extrato.findUnique({ where: { id: extratoId }, select: { id: true, clienteId: true } });
      if (!extrato) throw new UserFacingError("Extrato não encontrado.");
      clienteId = extrato.clienteId;
      if (id) {
        const existing = await tx.transacao.findFirst({ where: { id, extratoId }, select: { id: true } });
        if (!existing) throw new UserFacingError("Lançamento não encontrado neste extrato.");
        await tx.transacao.update({ where: { id }, data: payload });
      } else {
        await tx.transacao.create({ data: { ...payload, extratoId } });
      }
      await recalculateExtratoTotals(tx, extratoId);
    });

    revalidateFinancialPaths(extratoId, [clienteId]);
    return {};
  });
}

export async function deleteTransacao(id: string, extratoId: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const safeId = optionalIdField(id);
    const safeExtratoId = optionalIdField(extratoId);
    if (!safeId || !safeExtratoId) throw new UserFacingError("Lançamento inválido.");

    let clienteId = "";
    await prisma.$transaction(async (tx) => {
      const existing = await tx.transacao.findFirst({
        where: { id: safeId, extratoId: safeExtratoId },
        select: { id: true, extrato: { select: { clienteId: true } } },
      });
      if (!existing) throw new UserFacingError("Lançamento não encontrado neste extrato.");
      clienteId = existing.extrato.clienteId;
      await tx.transacao.delete({ where: { id: safeId } });
      await recalculateExtratoTotals(tx, safeExtratoId);
    });
    revalidateFinancialPaths(safeExtratoId, [clienteId]);
    return {};
  });
}
