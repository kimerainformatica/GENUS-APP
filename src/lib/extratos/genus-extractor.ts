import "server-only";

import { spawn } from "node:child_process";
import path from "node:path";

const GENUS_APP_DIR = path.join(process.cwd(), "GENUS-APP");
const CLI_PATH = path.join(GENUS_APP_DIR, "cli.py");
const PYTHON_BIN = process.env.PYTHON_BIN || "python";
const MAX_OUTPUT_BYTES = 12 * 1024 * 1024;
const configuredTimeout = Number(process.env.EXTRATOR_TIMEOUT_MS ?? 90_000);
const EXTRACTOR_TIMEOUT_MS = Number.isFinite(configuredTimeout) ? Math.min(Math.max(configuredTimeout, 10_000), 300_000) : 90_000;

export type GenusTipoOperacao = "PIX_RECEBIDO" | "PIX_ENVIADO" | "ENTRADA_OUTRA" | "SAIDA_OUTRA";

export type GenusTransacao = {
  data: string;
  nomeContraparte: string;
  tipoOperacao: GenusTipoOperacao;
  valorBruto: number;
  tarifaTaxa: number;
  valorLiquido: number;
  secao: string | null;
};

export type GenusExtractionResult = {
  banco: string;
  periodoDeclarado: string | null;
  saldoInicial: number | null;
  saldoFinal: number | null;
  somaCalculada: number;
  reconciliacaoOk: boolean | null;
  transacoes: GenusTransacao[];
};

export class GenusExtractionError extends Error {}

const BANK_DISPLAY_NAMES: Record<string, string> = { Itau: "Itaú" };
const OPERATION_TYPES = new Set<GenusTipoOperacao>(["PIX_RECEBIDO", "PIX_ENVIADO", "ENTRADA_OUTRA", "SAIDA_OUTRA"]);

export function bancoDisplayName(banco: string): string {
  return BANK_DISPLAY_NAMES[banco] ?? banco;
}

export function parseDataBR(value: string): Date {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) throw new GenusExtractionError("O extrator retornou uma data inválida.");
  const [, dia, mes, ano] = match;
  const date = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  if (date.toISOString().slice(0, 10) !== `${ano}-${mes}-${dia}`) throw new GenusExtractionError("O extrator retornou uma data inexistente.");
  return date;
}

export function classificarTipo(tipoOperacao: GenusTipoOperacao, nomeContraparte: string): string {
  const nome = nomeContraparte.toLowerCase();
  if (tipoOperacao === "PIX_RECEBIDO") return "PIX recebido";
  if (tipoOperacao === "PIX_ENVIADO") return "PIX enviado";
  if (nome.includes("ted")) return tipoOperacao === "ENTRADA_OUTRA" ? "TED recebida" : "TED enviada";
  if (nome.includes("boleto")) return "Pagamento de boleto";
  if (nome.includes("cartão") || nome.includes("cartao")) return "Compra no cartão";
  if (nome.includes("tarifa") || nome.includes("encargo")) return "Tarifa bancária";
  if (nome.includes("rendimento")) return "Rendimento";
  if (nome.includes("estorno")) return "Estorno";
  if (nome.includes("saque")) return "Saque";
  return "Não classificado";
}

function finiteNumber(value: unknown, label: string, nullable = false): number | null {
  if (nullable && value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new GenusExtractionError(`O extrator retornou ${label} inválido.`);
  return value;
}

function validateResult(value: unknown): GenusExtractionResult {
  if (!value || typeof value !== "object") throw new GenusExtractionError("O extrator retornou dados inválidos.");
  const result = value as Record<string, unknown>;
  if (typeof result.banco !== "string" || !result.banco.trim() || result.banco.length > 100) throw new GenusExtractionError("O banco do extrato não foi identificado.");
  if (!Array.isArray(result.transacoes) || result.transacoes.length === 0 || result.transacoes.length > 20_000) throw new GenusExtractionError("A quantidade de transações extraídas é inválida.");

  const transacoes = result.transacoes.map((raw) => {
    if (!raw || typeof raw !== "object") throw new GenusExtractionError("O extrator retornou uma transação inválida.");
    const item = raw as Record<string, unknown>;
    if (typeof item.data !== "string") throw new GenusExtractionError("O extrator retornou uma data inválida.");
    parseDataBR(item.data);
    if (!OPERATION_TYPES.has(item.tipoOperacao as GenusTipoOperacao)) throw new GenusExtractionError("O extrator retornou um tipo de operação inválido.");
    const tipoOperacao = item.tipoOperacao as GenusTipoOperacao;
    const nomeInformado = typeof item.nomeContraparte === "string" ? item.nomeContraparte.trim() : "";
    const nomeContraparte = nomeInformado || (tipoOperacao === "PIX_RECEBIDO"
      ? "PIX recebido — contraparte não informada"
      : tipoOperacao === "PIX_ENVIADO"
        ? "PIX enviado — contraparte não informada"
        : tipoOperacao === "ENTRADA_OUTRA"
          ? "Entrada — contraparte não informada"
          : "Saída — contraparte não informada");
    return {
      data: item.data,
      nomeContraparte: nomeContraparte.slice(0, 500),
      tipoOperacao,
      valorBruto: finiteNumber(item.valorBruto, "um valor bruto") as number,
      tarifaTaxa: finiteNumber(item.tarifaTaxa, "uma tarifa") as number,
      valorLiquido: finiteNumber(item.valorLiquido, "um valor líquido") as number,
      secao: typeof item.secao === "string" ? item.secao.trim().slice(0, 100) || null : null,
    };
  });

  return {
    banco: result.banco.trim(),
    periodoDeclarado: typeof result.periodoDeclarado === "string" ? result.periodoDeclarado.trim().slice(0, 100) || null : null,
    saldoInicial: finiteNumber(result.saldoInicial, "o saldo inicial", true),
    saldoFinal: finiteNumber(result.saldoFinal, "o saldo final", true),
    somaCalculada: finiteNumber(result.somaCalculada, "a soma calculada") as number,
    reconciliacaoOk: typeof result.reconciliacaoOk === "boolean" ? result.reconciliacaoOk : null,
    transacoes,
  };
}

export function runGenusExtractor(pdfPath: string): Promise<GenusExtractionResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let outputBytes = 0;
    let stdout = "";

    const finishError = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new GenusExtractionError(message));
    };

    const child = spawn(/* turbopackIgnore: true */ PYTHON_BIN, ["-X", "utf8", CLI_PATH, pdfPath], {
      cwd: GENUS_APP_DIR,
      windowsHide: true,
      env: { ...process.env, PYTHONUTF8: "1", PYTHONIOENCODING: "utf-8" },
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    const timer = setTimeout(() => {
      child.kill();
      finishError("O extrator excedeu o tempo máximo de processamento.");
    }, EXTRACTOR_TIMEOUT_MS);

    child.stdout.on("data", (chunk: string) => {
      outputBytes += Buffer.byteLength(chunk);
      if (outputBytes > MAX_OUTPUT_BYTES) {
        child.kill();
        finishError("O extrator retornou dados acima do limite permitido.");
        return;
      }
      stdout += chunk;
    });
    child.stderr.on("data", () => undefined);
    child.on("error", (error: NodeJS.ErrnoException) => {
      console.error("[GENUS-APP] Falha ao iniciar o Python", {
        code: error.code,
        executable: PYTHON_BIN,
        message: error.message,
      });
      if (error.code === "ENOENT") {
        return finishError("O executável do Python não foi encontrado. Configure PYTHON_BIN no arquivo .env.");
      }
      if (error.code === "EACCES" || error.code === "EPERM") {
        return finishError("O sistema bloqueou a execução do Python. Verifique as permissões do executável configurado em PYTHON_BIN.");
      }
      return finishError("Não foi possível iniciar o extrator. Verifique a configuração PYTHON_BIN.");
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (settled) return;
      if (!stdout.trim()) return finishError(`O extrator não retornou dados (código ${code ?? "desconhecido"}).`);
      try {
        const parsed = JSON.parse(stdout) as unknown;
        if (parsed && typeof parsed === "object" && "error" in parsed) {
          const error = (parsed as { error?: unknown }).error;
          return finishError(typeof error === "string" ? error.slice(0, 300) : "O extrator não conseguiu ler este PDF.");
        }
        settled = true;
        resolve(validateResult(parsed));
      } catch (error) {
        if (error instanceof GenusExtractionError) return finishError(error.message);
        return finishError("O extrator retornou uma resposta que não pôde ser interpretada.");
      }
    });
  });
}
