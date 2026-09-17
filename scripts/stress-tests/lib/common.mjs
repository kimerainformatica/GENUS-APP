// Utilitários compartilhados pelo protocolo de testes de estresse/crash.
// Nenhum script deste diretório toca no dev.db real: tudo roda sobre cópias
// isoladas dentro de scripts/stress-tests/.tmp/.

import Database from "better-sqlite3";
import { existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../../..");
export const TMP_DIR = path.join(PROJECT_ROOT, "scripts", "stress-tests", ".tmp");
export const REPORTS_DIR = path.join(PROJECT_ROOT, "scripts", "stress-tests", "reports");
export const SOURCE_DB = path.join(PROJECT_ROOT, "dev.db");

export function ensureDirs() {
  mkdirSync(TMP_DIR, { recursive: true });
  mkdirSync(REPORTS_DIR, { recursive: true });
}

/** Copia o dev.db real para um arquivo de teste isolado, descartando WAL/SHM/journal antigos do destino. */
export function makeIsolatedCopy(name) {
  ensureDirs();
  const dest = path.join(TMP_DIR, name);
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const f = dest + suffix;
    if (existsSync(f)) rmSync(f, { force: true });
  }
  if (!existsSync(SOURCE_DB)) {
    throw new Error(`dev.db não encontrado em ${SOURCE_DB}. Rode a partir da raiz do projeto.`);
  }
  copyFileSync(SOURCE_DB, dest);
  return dest;
}

export function removeIsolatedCopy(dest) {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    const f = dest + suffix;
    if (existsSync(f)) rmSync(f, { force: true });
  }
}

/** Abre uma conexão better-sqlite3 crua, sem passar pelo Prisma. */
export function openRaw(dbPath, options = {}) {
  return new Database(dbPath, options);
}

/** PRAGMA integrity_check + foreign_key_check, a checagem definitiva de corrupção do arquivo SQLite. */
export function checkIntegrity(dbPath) {
  const db = openRaw(dbPath, { fileMustExist: true });
  try {
    const integrity = db.pragma("integrity_check");
    const fkIssues = db.pragma("foreign_key_check");
    const okIntegrity = integrity.length === 1 && integrity[0].integrity_check === "ok";
    return {
      ok: okIntegrity && fkIssues.length === 0,
      integrity,
      foreignKeyIssues: fkIssues,
    };
  } finally {
    db.close();
  }
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Espera até que a URL responda (qualquer status HTTP), com timeout. */
export async function waitForHttp(url, { timeoutMs = 30_000, intervalMs = 250 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status) return true;
    } catch {
      // servidor ainda não subiu
    }
    await sleep(intervalMs);
  }
  throw new Error(`Timeout esperando ${url} responder após ${timeoutMs}ms`);
}

export function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.floor((p / 100) * sortedArr.length));
  return sortedArr[idx];
}

export function summarizeLatencies(latenciesMs) {
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: sorted[0] ?? 0,
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] ?? 0,
    avg: sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : 0,
  };
}

export function section(title) {
  console.log(`\n${"=".repeat(70)}\n${title}\n${"=".repeat(70)}`);
}
