// PROTOCOLO 03 — Abrir/fechar o banco por fora enquanto o app está em uso.
//
// Simula outro programa mexendo no mesmo arquivo dev.db ao mesmo tempo que o
// app grava dados: um antivírus escaneando o arquivo, uma rotina de backup
// copiando o .db, alguém abrindo o dev.db no DB Browser for SQLite, etc.
// Um processo escritor contínuo (worker-write-loop.mjs) fica gravando lotes
// enquanto o processo pai abre e fecha conexões externas repetidamente,
// algumas delas segurando o lock de escrita (BEGIN IMMEDIATE) por um tempo
// aleatório antes de liberar.
//
// O que caracteriza sucesso aqui NÃO é "zero erro": é esperado que apareçam
// erros de SQLITE_BUSY/SQLITE_LOCKED quando dois lados disputam o lock de
// escrita do SQLite (ele só permite um escritor por vez). O teste falha se:
//   - o arquivo ficar corrompido (integrity_check falhar);
//   - o escritor trava por completo (nenhum lote consegue progredir); ou
//   - aparecer qualquer erro que não seja de lock/timeout (bug real).
//
// Variáveis de ambiente:
//   LOCK_TEST_DURATION_MS   duração do teste (padrão 15000)
//   LOCK_HOLD_MIN_MS / LOCK_HOLD_MAX_MS   quanto tempo cada "abertura externa" seguraum o lock (padrão 20-250ms)
//   LOCK_GAP_MIN_MS / LOCK_GAP_MAX_MS     intervalo entre uma abertura externa e outra (padrão 10-150ms)

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

const DURATION_MS = Number(process.env.LOCK_TEST_DURATION_MS ?? 15_000);
const HOLD_MIN_MS = Number(process.env.LOCK_HOLD_MIN_MS ?? 20);
const HOLD_MAX_MS = Number(process.env.LOCK_HOLD_MAX_MS ?? 250);
const GAP_MIN_MS = Number(process.env.LOCK_GAP_MIN_MS ?? 10);
const GAP_MAX_MS = Number(process.env.LOCK_GAP_MAX_MS ?? 150);
const WRITER_BATCH_SIZE = 20;

const LOCK_ERROR_CODES = new Set(["SQLITE_BUSY", "SQLITE_LOCKED", "SQLITE_BUSY_SNAPSHOT"]);

async function externalOpenCloseLoop(dbPath, stopAt, stats) {
  while (Date.now() < stopAt) {
    stats.opens++;
    try {
      const conn = openRaw(dbPath, { timeout: 2000 });
      try {
        conn.prepare("BEGIN IMMEDIATE").run();
        stats.locksAcquired++;
        await sleep(randomInt(HOLD_MIN_MS, HOLD_MAX_MS));
        conn.prepare("COMMIT").run();
      } catch (error) {
        stats.lockErrors.push(error.code ?? String(error.message));
      } finally {
        conn.close();
      }
    } catch (error) {
      stats.lockErrors.push(error.code ?? String(error.message));
    }
    await sleep(randomInt(GAP_MIN_MS, GAP_MAX_MS));
  }
}

async function main() {
  ensureDirs();
  section("PROTOCOLO 03 — Abrir/fechar o banco externamente durante uso do app");
  console.log(`Duração: ${DURATION_MS}ms | lock externo: ${HOLD_MIN_MS}-${HOLD_MAX_MS}ms | intervalo: ${GAP_MIN_MS}-${GAP_MAX_MS}ms`);

  const dbPath = makeIsolatedCopy("lock-test.db");
  console.log(`Banco isolado em uso: ${dbPath}`);

  const writer = fork(WORKER, [dbPath, String(WRITER_BATCH_SIZE)], { silent: true });
  let okBatches = 0;
  const writerErrors = [];
  writer.stdout.on("data", (buf) => {
    for (const line of buf.toString().split("\n")) {
      if (!line.trim()) continue;
      if (line.startsWith("OK")) okBatches++;
      else if (line.startsWith("ERR")) writerErrors.push(line);
    }
  });

  const stopAt = Date.now() + DURATION_MS;
  const externalStats = { opens: 0, locksAcquired: 0, lockErrors: [] };
  await externalOpenCloseLoop(dbPath, stopAt, externalStats);

  writer.kill("SIGKILL");
  await new Promise((resolve) => writer.once("exit", resolve));
  await sleep(75);

  const integrity = checkIntegrity(dbPath);
  const db = openRaw(dbPath, { fileMustExist: true, readonly: true });
  const committedBatches = db.prepare("SELECT COUNT(*) AS n FROM Extrato WHERE id LIKE 'stress-%'").get().n;
  db.close();

  const unexpectedWriterErrors = writerErrors.filter((line) => {
    const code = line.split(" ")[1];
    return !LOCK_ERROR_CODES.has(code);
  });
  const unexpectedExternalErrors = externalStats.lockErrors.filter((code) => !LOCK_ERROR_CODES.has(code));

  section("RESULTADO — 03 Contenção de lock externo");
  console.log(`Aberturas externas tentadas: ${externalStats.opens} (locks de escrita obtidos: ${externalStats.locksAcquired})`);
  console.log(`Erros de lock (esperados) do lado externo: ${externalStats.lockErrors.length - unexpectedExternalErrors.length}`);
  console.log(`Lotes do app commitados com sucesso durante a contenção: ${okBatches} (confirmados no banco: ${committedBatches})`);
  console.log(`Erros do escritor do app: ${writerErrors.length} (dos quais inesperados/não-lock: ${unexpectedWriterErrors.length})`);
  console.log(`Integridade do arquivo ao final: ${integrity.ok ? "OK" : "CORROMPIDO"}`);

  const madeProgress = okBatches > 0;
  const verdict =
    integrity.ok && madeProgress && unexpectedWriterErrors.length === 0 && unexpectedExternalErrors.length === 0
      ? "PASSOU"
      : "FALHOU";
  console.log(`\nVEREDITO: ${verdict}`);
  if (!madeProgress) console.log("Motivo da falha: o escritor do app não conseguiu commitar nenhum lote (possível deadlock/starvation).");
  if (unexpectedWriterErrors.length) console.log("Erros inesperados do escritor:", unexpectedWriterErrors.slice(0, 5));
  if (unexpectedExternalErrors.length) console.log("Erros externos inesperados:", unexpectedExternalErrors.slice(0, 5));

  const report = {
    verdict,
    durationMs: DURATION_MS,
    externalOpensAttempted: externalStats.opens,
    externalLocksAcquired: externalStats.locksAcquired,
    appBatchesCommitted: okBatches,
    appBatchesCommittedConfirmed: committedBatches,
    appWriterErrors: writerErrors.length,
    unexpectedWriterErrors,
    unexpectedExternalErrors,
    integrityOk: integrity.ok,
  };
  writeFileSync(path.join(REPORTS_DIR, "03-lock-contention-test.json"), JSON.stringify(report, null, 2));
  console.log(`\nRelatório salvo em scripts/stress-tests/reports/03-lock-contention-test.json`);

  if (verdict === "PASSOU") {
    removeIsolatedCopy(dbPath);
  } else {
    console.log(`Cópia do banco preservada para inspeção manual: ${dbPath}`);
  }

  process.exit(verdict === "PASSOU" ? 0 : 1);
}

main();
