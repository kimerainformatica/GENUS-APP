// PROTOCOLO 01 — Carga concorrente (estilo "DDoS" controlado) + acesso externo ao banco.
//
// Importante: isto é um teste de carga LOCAL contra a própria instância de
// desenvolvimento do app, não um ataque de negação de serviço contra terceiros.
// Serve para verificar como o app se comporta sob muitas requisições
// simultâneas, não para atacar nada fora desta máquina.
//
// O que o teste faz:
//   1. Copia o dev.db e cria um usuário admin de teste só na cópia.
//   2. Sobe uma segunda instância do "next dev" numa porta e distDir isolados
//      (nunca mexe na instância real do usuário, se houver uma rodando).
//   3. Dispara ondas de requisições concorrentes: páginas públicas, tentativas
//      de login (válidas e inválidas) e páginas autenticadas (dashboard,
//      clientes, extratos) — enquanto, ao mesmo tempo, um processo externo
//      abre e fecha conexões com o arquivo do banco (como um antivírus ou
//      backup fariam durante o uso normal do app).
//   4. Ao final, derruba o servidor e roda PRAGMA integrity_check na cópia.
//
// Variáveis de ambiente:
//   LOAD_WAVES         número de ondas de rajada (padrão 6)
//   LOAD_CONCURRENCY   requisições simultâneas por onda (padrão 40)
//   LOAD_PORT          porta da instância de teste (padrão 3979)

import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcrypt";
import {
  makeIsolatedCopy,
  removeIsolatedCopy,
  checkIntegrity,
  openRaw,
  randomInt,
  sleep,
  waitForHttp,
  summarizeLatencies,
  section,
  REPORTS_DIR,
  ensureDirs,
  PROJECT_ROOT,
} from "./lib/common.mjs";

const WAVES = Number(process.env.LOAD_WAVES ?? 6);
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? 40);
const PORT = Number(process.env.LOAD_PORT ?? 3979);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ADMIN_EMAIL = "stress-test@genus.local";
const ADMIN_PASSWORD = "StressTest!12345";

function seedAdmin(dbPath) {
  const db = openRaw(dbPath, { fileMustExist: true });
  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  const now = new Date().toISOString();
  const existing = db.prepare("SELECT id FROM Usuario WHERE email = ?").get(ADMIN_EMAIL);
  if (existing) {
    db.prepare("UPDATE Usuario SET senhaHash=?, role='ADMIN', ativo=1, updatedAt=? WHERE id=?").run(passwordHash, now, existing.id);
  } else {
    db.prepare(
      "INSERT INTO Usuario (id, nome, email, senhaHash, role, ativo, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?)",
    ).run("stress-test-admin", "Stress Test Admin", ADMIN_EMAIL, passwordHash, "ADMIN", 1, now, now);
  }
  db.close();
}

function startServer(dbPath) {
  // Chama o entrypoint JS do Next diretamente (em vez do shim .bin/next.cmd),
  // porque no Windows child_process.spawn não executa arquivos .cmd sem shell:true.
  const nextCli = path.join(PROJECT_ROOT, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextCli, "dev", "-p", String(PORT)], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      DATABASE_URL: `file:${dbPath}`,
      STRESS_TEST_DIST_DIR: ".next-stress-test",
      PORT: String(PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  child.stdout.on("data", (b) => (log += b.toString()));
  child.stderr.on("data", (b) => (log += b.toString()));
  return { child, getLog: () => log };
}

async function timedFetch(url, options) {
  const start = performance.now();
  try {
    const res = await fetch(url, { redirect: "manual", ...options });
    await res.arrayBuffer().catch(() => {});
    return { status: res.status, ms: performance.now() - start, headers: res.headers };
  } catch (error) {
    return { status: 0, ms: performance.now() - start, error: String(error.message ?? error) };
  }
}

function extractSessionCookie(headers) {
  const setCookie = headers.get("set-cookie");
  if (!setCookie) return null;
  const match = setCookie.match(/genus_session=[^;]+/);
  return match ? match[0] : null;
}

async function externalPokeLoop(dbPath, stopAt, stats) {
  while (Date.now() < stopAt) {
    try {
      const conn = openRaw(dbPath, { timeout: 1000 });
      conn.prepare("SELECT COUNT(*) AS n FROM Usuario").get();
      conn.close();
      stats.pokes++;
    } catch (error) {
      stats.errors.push(error.code ?? String(error.message));
    }
    await sleep(randomInt(30, 120));
  }
}

async function runWave(waveIndex, sessionCookie, results) {
  const tasks = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    const kind = i % 5;
    if (kind === 0) {
      tasks.push(timedFetch(`${BASE_URL}/`).then((r) => ({ ...r, kind: "home" })));
    } else if (kind === 1) {
      tasks.push(timedFetch(`${BASE_URL}/login`).then((r) => ({ ...r, kind: "login-page" })));
    } else if (kind === 2) {
      tasks.push(
        timedFetch(`${BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: ADMIN_EMAIL, password: "senha-errada-de-proposito" }),
        }).then((r) => ({ ...r, kind: "login-invalid" })),
      );
    } else if (kind === 3 && sessionCookie) {
      tasks.push(
        timedFetch(`${BASE_URL}/dashboard`, { headers: { cookie: sessionCookie } }).then((r) => ({ ...r, kind: "dashboard-auth" })),
      );
    } else if (sessionCookie) {
      tasks.push(
        timedFetch(`${BASE_URL}/clientes`, { headers: { cookie: sessionCookie } }).then((r) => ({ ...r, kind: "clientes-auth" })),
      );
    } else {
      tasks.push(timedFetch(`${BASE_URL}/login`).then((r) => ({ ...r, kind: "login-page" })));
    }
  }
  const settled = await Promise.all(tasks);
  results.push(...settled);
  const errors = settled.filter((r) => r.status === 0 || r.status >= 500).length;
  console.log(`Onda ${waveIndex}/${WAVES}: ${CONCURRENCY} reqs simultâneas | falhas(0/5xx)=${errors}`);
}

async function main() {
  ensureDirs();
  section("PROTOCOLO 01 — Carga concorrente + acesso externo ao banco");
  console.log(`Ondas: ${WAVES} | concorrência por onda: ${CONCURRENCY} | porta de teste: ${PORT}`);

  const dbPath = makeIsolatedCopy("load-test.db");
  seedAdmin(dbPath);
  console.log(`Banco isolado em uso: ${dbPath}`);

  const { child, getLog } = startServer(dbPath);
  let serverCrashed = false;
  child.on("exit", (code, signal) => {
    if (code !== 0 && code !== null) serverCrashed = true;
  });

  try {
    await waitForHttp(`${BASE_URL}/login`, { timeoutMs: 60_000 });
    console.log("Servidor de teste no ar.");

    const loginRes = await timedFetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    const sessionCookie = extractSessionCookie(loginRes.headers);
    console.log(`Login de teste: status=${loginRes.status} cookie=${sessionCookie ? "obtido" : "AUSENTE"}`);

    const externalStats = { pokes: 0, errors: [] };
    const stopAt = Date.now() + WAVES * 1500 + 3000;
    const pokePromise = externalPokeLoop(dbPath, stopAt, externalStats);

    const results = [];
    for (let w = 1; w <= WAVES; w++) {
      await runWave(w, sessionCookie, results);
      await sleep(150);
    }
    await pokePromise;

    const byStatus = {};
    for (const r of results) {
      const key = r.status === 0 ? "erro-de-rede" : String(r.status);
      byStatus[key] = (byStatus[key] ?? 0) + 1;
    }
    const latencySummary = summarizeLatencies(results.map((r) => r.ms));
    const serverErrors = results.filter((r) => r.status === 0 || r.status >= 500);

    child.kill();
    await sleep(500);
    if (!child.killed) child.kill("SIGKILL");

    await sleep(300);
    const integrity = checkIntegrity(dbPath);

    section("RESULTADO — 01 Carga concorrente");
    console.log(`Total de requisições: ${results.length}`);
    console.log(`Distribuição de status: ${JSON.stringify(byStatus)}`);
    console.log(`Latência (ms): ${JSON.stringify(latencySummary)}`);
    console.log(`Aberturas externas do banco durante a carga: ${externalStats.pokes} (erros: ${externalStats.errors.length})`);
    console.log(`Servidor caiu inesperadamente: ${serverCrashed ? "SIM" : "NÃO"}`);
    console.log(`Integridade do arquivo ao final: ${integrity.ok ? "OK" : "CORROMPIDO"}`);

    const verdict = serverErrors.length === 0 && !serverCrashed && integrity.ok ? "PASSOU" : "FALHOU";
    console.log(`\nVEREDITO: ${verdict}`);
    if (serverErrors.length) {
      console.log(`Exemplos de falhas:`, serverErrors.slice(0, 5).map((r) => ({ kind: r.kind, status: r.status, error: r.error })));
    }

    const report = {
      verdict,
      totalRequests: results.length,
      statusBreakdown: byStatus,
      latencyMs: latencySummary,
      externalDbPokes: externalStats.pokes,
      externalDbPokeErrors: externalStats.errors.length,
      serverCrashed,
      integrityOk: integrity.ok,
      loginObtainedCookie: Boolean(sessionCookie),
    };
    writeFileSync(path.join(REPORTS_DIR, "01-load-concurrency-test.json"), JSON.stringify(report, null, 2));
    console.log(`\nRelatório salvo em scripts/stress-tests/reports/01-load-concurrency-test.json`);

    if (verdict === "PASSOU") {
      removeIsolatedCopy(dbPath);
    } else {
      console.log(`Cópia do banco preservada para inspeção manual: ${dbPath}`);
      console.log(`Últimas linhas de log do servidor de teste:\n${getLog().split("\n").slice(-40).join("\n")}`);
    }
    process.exit(verdict === "PASSOU" ? 0 : 1);
  } catch (error) {
    console.error("Falha ao rodar o teste de carga:", error);
    console.error("Log do servidor:\n", getLog().split("\n").slice(-60).join("\n"));
    try {
      child.kill("SIGKILL");
    } catch {}
    process.exit(1);
  }
}

main();
