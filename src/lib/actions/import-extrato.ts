"use server";

import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { classificarCategoria } from "@/lib/extratos/categories";
import { bancoDisplayName, classificarTipo, GenusExtractionError, parseDataBR, runGenusExtractor } from "@/lib/extratos/genus-extractor";
import { roundMoney, sumMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { optionalIdField } from "@/lib/validation";

const configuredMaxMb = Number(process.env.MAX_PDF_SIZE_MB ?? 10);
const MAX_PDF_SIZE = (Number.isFinite(configuredMaxMb) ? Math.min(Math.max(configuredMaxMb, 1), 10) : 10) * 1024 * 1024;

export type ImportExtratoResult =
  | {
      success: true;
      fileName: string;
      extratoId: string;
      clienteId: string;
      banco: string;
      transacoesCount: number;
      reconciliacaoOk: boolean | null;
    }
  | { success: false; fileName: string; error: string };

function safeFileName(name: string): string {
  return name.replace(/^.*[\\/]/, "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 180) || "extrato.pdf";
}

function isUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function importExtratoPdf(formData: FormData): Promise<ImportExtratoResult> {
  await requireSession();
  const rawClienteId = formData.get("clienteId");
  const file = formData.get("file");
  const fileName = file instanceof File ? safeFileName(file.name) : "arquivo";

  if (!(file instanceof File)) return { success: false, fileName, error: "Nenhum arquivo enviado." };
  const clienteId = optionalIdField(rawClienteId);
  if (!clienteId) return { success: false, fileName, error: "Selecione o cliente do extrato." };
  if (!fileName.toLowerCase().endsWith(".pdf")) return { success: false, fileName, error: "O arquivo precisa ter extensão PDF." };
  if (file.size === 0) return { success: false, fileName, error: "O PDF enviado está vazio." };
  if (file.size > MAX_PDF_SIZE) return { success: false, fileName, error: `O PDF excede o limite de ${Math.round(MAX_PDF_SIZE / 1024 / 1024)} MB.` };

  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
  if (!cliente) return { success: false, fileName, error: "Cliente não encontrado." };

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-") return { success: false, fileName, error: "O arquivo enviado não contém um PDF válido." };
  const arquivoHash = createHash("sha256").update(buffer).digest("hex");
  const duplicate = await prisma.extrato.findUnique({
    where: { clienteId_arquivoHash: { clienteId, arquivoHash } },
    select: { id: true },
  });
  if (duplicate) return { success: false, fileName, error: "Este PDF já foi importado para o cliente selecionado." };

  const tempDir = await mkdtemp(path.join(tmpdir(), "genus-extrato-"));
  const tempPath = path.join(tempDir, "statement.pdf");

  try {
    await writeFile(tempPath, buffer, { flag: "wx" });
    const extraido = await runGenusExtractor(tempPath);

    const transactionDates: Date[] = [];
    const entradaValues: number[] = [];
    const saidaValues: number[] = [];
    const transacoesData = extraido.transacoes.map((transaction) => {
      const data = parseDataBR(transaction.data);
      transactionDates.push(data);
      if (transaction.valorLiquido >= 0) entradaValues.push(transaction.valorLiquido);
      else saidaValues.push(Math.abs(transaction.valorLiquido));
      return {
        data,
        tipo: classificarTipo(transaction.tipoOperacao, transaction.nomeContraparte),
        tipoOperacao: transaction.tipoOperacao,
        categoria: classificarCategoria(transaction.tipoOperacao, transaction.nomeContraparte),
        descricao: transaction.nomeContraparte,
        identificador: null,
        nomeContraparte: transaction.nomeContraparte,
        tarifaTaxa: roundMoney(transaction.tarifaTaxa),
        valorBruto: roundMoney(transaction.valorBruto),
        valor: roundMoney(transaction.valorLiquido),
        saldoApos: null,
        secao: transaction.secao,
      };
    });
    const timestamps = transactionDates.map((date) => date.getTime());

    const extrato = await prisma.extrato.create({
      data: {
        clienteId,
        instituicao: bancoDisplayName(extraido.banco),
        periodoInicio: new Date(Math.min(...timestamps)),
        periodoFim: new Date(Math.max(...timestamps)),
        saldoInicial: extraido.saldoInicial === null ? null : roundMoney(extraido.saldoInicial),
        saldoFinal: extraido.saldoFinal === null ? null : roundMoney(extraido.saldoFinal),
        totalEntradas: sumMoney(entradaValues),
        totalSaidas: sumMoney(saidaValues),
        arquivoNome: fileName,
        arquivoHash,
        periodoDeclarado: extraido.periodoDeclarado,
        somaCalculada: roundMoney(extraido.somaCalculada),
        reconciliacaoOk: extraido.reconciliacaoOk,
        origem: "IMPORTADO",
        transacoes: { create: transacoesData },
      },
      select: { id: true },
    });

    revalidatePath("/extratos");
    revalidatePath("/dashboard");
    revalidatePath(`/clientes/${clienteId}`);
    revalidatePath(`/extratos/${extrato.id}`);
    return {
      success: true,
      fileName,
      extratoId: extrato.id,
      clienteId,
      banco: bancoDisplayName(extraido.banco),
      transacoesCount: transacoesData.length,
      reconciliacaoOk: extraido.reconciliacaoOk,
    };
  } catch (error) {
    if (isUniqueError(error)) return { success: false, fileName, error: "Este PDF já foi importado para o cliente selecionado." };
    const message = error instanceof GenusExtractionError ? error.message : "Não foi possível importar o extrato. Tente novamente.";
    return { success: false, fileName, error: message };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
