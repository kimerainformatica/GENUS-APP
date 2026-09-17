// PROTOCOLO 02 — Interrupção abrupta / simulação de "desligamento do computador".
//
// SIGKILL não pode ser interceptado pelo processo (nem no Windows, onde o Node
// traduz isso em TerminateProcess): é a melhor simulação local e segura de uma
// queda de energia ou travamento do SO, sem precisar desligar a máquina de verdade.
//
// O que o teste faz:
//   1. Copia o dev.db para um arquivo isolado (nunca mexe no banco real).
//   2. Sobe um processo filho que escreve, sem parar, lotes Cliente->Extrato->Transacao
//      dentro de transações atômicas (mesmo padrão do import de extratos real).
//   3. Em intervalos aleatórios e imprevisíveis, mata o processo filho na marra.
//   4. Depois de cada morte, roda PRAGMA integrity_check/foreign_key_check e confere
//      se todo Extrato tem exatamente o número de Transacao esperado (nenhuma
//      escrita parcial), repetindo por N ciclos.
//
// Variáveis de ambiente:
//   STRESS_CYCLES        número de ciclos kill/restart (padrão 25)
//   STRESS_BATCH_SIZE    transações por lote, controla a duração de cada transação (padrão 300)
//   STRESS_MIN_KILL_MS / STRESS_MAX_KILL_MS   janela aleatória para o kill (padrão 40-500ms)

import { fork } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  makeIsolatedCopy,
  removeIsolatedCopy,
  checkIntegrity,
  openRaw,
  randomInt,
  sleep,
  section,
  REPORTS_DIR,
  ensureDirs,
} from "./lib/common.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(__dirname, "worker-write-loop.mjs");

const CYCLES = Number(process.env.STRESS_CYCLES ?? 25);
const BATCH_SIZE = Number(process.env.STRESS_BATCH_SIZE ?? 300);
const MIN_KILL_MS = Number(process.env.STRESS_MIN_KILL_MS ?? 40);
const MAX_KILL_MS = Number(process.env.STRESS_MAX_KILL_MS ?? 500);

async function runOneCycle(dbPath, cycleIndex) {
  const child = fork(WORKER, [dbPath, String(BATCH_SIZE)], { silent: true });
  let okBatches = 0;
  let errBatches = 0;
  child.stdout.on("data", (buf) => {
    for (const line of buf.toString().split("\n")) {
      if (line.startsWith("OK")) okBatches++;
      else if (line.startsWith("ERR")) errBatches++;
    }
  });
  child.on("error", () => {});

  const killDelay = randomInt(MIN_KILL_MS, MAX_KILL_MS);
  await sleep(killDelay);
  child.kill("SIGKILL");
  await new Promise((resolve) => child.once("exit", resolve));
  await sleep(75); // dá tempo do SO liberar o handle do arquivo antes de reabrir

  const integrity = checkIntegrity(dbPath);
  return { cycle: cycleIndex, killDelayMs: killDelay, okBatches, errBatches, integrityOk: integrity.ok, integrity };
}

async function main() {
  ensureDirs();
  section("PROTOCOLO 02 — Interrupção abrupta (simulação de queda de energia/travamento)");
  console.log(`Ciclos: ${CYCLES} | transações por lote: ${BATCH_SIZE} | janela de kill: ${MIN_KILL_MS}-${MAX_KILL_MS}ms`);

  const dbPath = makeIsolatedCopy("crash-test.db");
  console.log(`Banco isolado em uso: ${dbPath}`);

  const before = checkIntegrity(dbPath);
  console.log(`Integridade inicial da cópia: ${before.ok ? "OK" : "FALHOU (verifique o dev.db de origem!)"}`);
  if (!before.ok) {
    console.error(JSON.stringify(before, null, 2));
    process.exit(1);
  }

  const cycleReports = [];
  let corruptionDetected = false;

  for (let cycle = 1; cycle <= CYCLES; cycle++) {
    const result = await runOneCycle(dbPath, cycle);
    cycleReports.push(result);
    console.log(
      `Ciclo ${cycle}/${CYCLES}: kill após ${result.killDelayMs}ms | lotes ok=${result.okBatches} erro=${result.errBatches} | integridade=${result.integrityOk ? "OK" : "CORROMPIDO"}`,
    );
    if (!result.integrityOk) {
      corruptionDetected = true;
      console.error("!!! Corrupção de arquivo SQLite detectada:", JSON.stringify(result.integrity, null, 2));
      break;
    }
  }

  const db = openRaw(dbPath, { fileMustExist: true, readonly: true });
  const extratos = db.prepare("SELECT id FROM Extrato WHERE id LIKE 'stress-%'").all();
  let inconsistentBatches = 0;
  for (const { id } of extratos) {
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM Transacao WHERE extratoId = ?").get(id);
    if (n !== BATCH_SIZE) inconsistentBatches++;
  }
  const orphanExtratos = db.prepare(
    "SELECT COUNT(*) AS n FROM Extrato e LEFT JOIN Cliente c ON c.id = e.clienteId WHERE c.id IS NULL",
  ).get().n;
  db.close();

  section("RESULTADO — 02 Interrupção abrupta");
  console.log(`Ciclos completos: ${cycleReports.length}/${CYCLES}`);
  console.log(`Lotes (Extrato+${BATCH_SIZE} Transacao) commitados com sucesso no total: ${extratos.length}`);
  console.log(`Lotes com contagem de transações inconsistente (indício de escrita parcial): ${inconsistentBatches}`);
  console.log(`Extratos órfãos (sem Cliente correspondente): ${orphanExtratos}`);
  console.log(`Corrupção de arquivo SQLite detectada: ${corruptionDetected ? "SIM" : "NÃO"}`);

  const verdict = !corruptionDetected && inconsistentBatches === 0 && orphanExtratos === 0 ? "PASSOU" : "FALHOU";
  console.log(`\nVEREDITO: ${verdict}`);

  const report = {
    verdict,
    cyclesPlanned: CYCLES,
    cyclesCompleted: cycleReports.length,
    batchSize: BATCH_SIZE,
    extratosCommitted: extratos.length,
    inconsistentBatches,
    orphanExtratos,
    corruptionDetected,
    cycles: cycleReports.map(({ integrity: _integrity, ...rest }) => rest),
  };
  writeFileSync(path.join(REPORTS_DIR, "02-crash-interruption-test.json"), JSON.stringify(report, null, 2));
  console.log(`\nRelatório salvo em scripts/stress-tests/reports/02-crash-interruption-test.json`);

  if (verdict === "PASSOU") {
    removeIsolatedCopy(dbPath);
  } else {
    console.log(`Cópia do banco preservada para inspeção manual: ${dbPath}`);
  }

  process.exit(verdict === "PASSOU" ? 0 : 1);
}

main();
