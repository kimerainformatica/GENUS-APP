// Roda o protocolo completo (01 -> 02 -> 03) em sequência e imprime um resumo final.
// Cada script já é independente e pode ser rodado sozinho; este apenas encadeia.

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { section } from "./lib/common.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUITES = [
  { name: "01 - Carga concorrente + acesso externo ao banco", file: "01-load-concurrency-test.mjs" },
  { name: "02 - Interrupção abrupta (simulação de queda de energia)", file: "02-crash-interruption-test.mjs" },
  { name: "03 - Abrir/fechar o banco externamente durante uso", file: "03-lock-contention-test.mjs" },
];

function runSuite(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, file)], { stdio: "inherit" });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const results = [];
  for (const suite of SUITES) {
    section(`INICIANDO: ${suite.name}`);
    const code = await runSuite(suite.file);
    results.push({ ...suite, code, verdict: code === 0 ? "PASSOU" : "FALHOU" });
  }

  section("RESUMO DO PROTOCOLO COMPLETO");
  for (const r of results) {
    console.log(`${r.verdict === "PASSOU" ? "✔" : "✘"} ${r.name}: ${r.verdict}`);
  }
  const allPassed = results.every((r) => r.code === 0);
  console.log(`\nVEREDITO GERAL: ${allPassed ? "PASSOU" : "FALHOU"}`);
  console.log(`Relatórios detalhados em scripts/stress-tests/reports/`);
  process.exit(allPassed ? 0 : 1);
}

main();
