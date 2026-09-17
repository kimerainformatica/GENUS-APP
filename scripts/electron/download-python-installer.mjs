// Baixa o instalador oficial do Python (python.org) uma única vez e guarda em
// electron/resources/python-installer.exe. É esse arquivo, e não uma cópia
// fabricada, que o app abre quando detecta que o Python não está instalado
// na máquina do usuário (ver electron/python-check.cjs).
//
// Reaproveita o arquivo já baixado se ele já existir — rode com --force para
// forçar um novo download (ex.: para atualizar a versão empacotada).

import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESOURCES_DIR = path.join(__dirname, "..", "..", "electron", "resources");
const DEST = path.join(RESOURCES_DIR, "python-installer.exe");

// Instalador oficial 64-bit do python.org. Atualize esta constante quando
// quiser empacotar uma versão mais nova.
const PYTHON_VERSION = "3.12.7";
const URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-amd64.exe`;
const MIN_EXPECTED_BYTES = 20 * 1024 * 1024; // o instalador real tem ~25MB; abaixo disso é resposta de erro/HTML

const force = process.argv.includes("--force");

async function main() {
  mkdirSync(RESOURCES_DIR, { recursive: true });

  if (existsSync(DEST) && !force) {
    const size = statSync(DEST).size;
    if (size > MIN_EXPECTED_BYTES) {
      console.log(`Instalador do Python já presente (${(size / 1024 / 1024).toFixed(1)} MB): ${DEST}`);
      return;
    }
    console.log("Arquivo existente parece incompleto, baixando de novo...");
  }

  console.log(`Baixando instalador oficial do Python ${PYTHON_VERSION}...`);
  console.log(URL);

  const res = await fetch(URL);
  if (!res.ok || !res.body) {
    throw new Error(`Falha ao baixar o instalador do Python: HTTP ${res.status}`);
  }

  const tmpDest = `${DEST}.download`;
  await pipeline(res.body, createWriteStream(tmpDest));

  const size = statSync(tmpDest).size;
  if (size < MIN_EXPECTED_BYTES) {
    unlinkSync(tmpDest);
    throw new Error(`Download incompleto ou inválido (${size} bytes recebidos).`);
  }

  const { renameSync } = await import("node:fs");
  renameSync(tmpDest, DEST);
  console.log(`Instalador do Python salvo em ${DEST} (${(size / 1024 / 1024).toFixed(1)} MB).`);
}

main().catch((error) => {
  console.error(error.message);
  console.error(
    "\nNão foi possível baixar o instalador automaticamente. Baixe manualmente em " +
      "https://www.python.org/downloads/windows/ e salve o arquivo .exe como:\n" +
      DEST,
  );
  process.exit(1);
});
