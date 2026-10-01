// Monta o Python que vai DENTRO do instalador, em electron/resources/python/:
// a distribuição "embeddable" oficial do python.org (sem instalador, sem
// PATH, sem registro) + as dependências do extrator de PDF
// (scripts/requirements-extratos.txt) já instaladas nela.
//
// O app empacotado usa sempre este Python (electron/main.cjs → PYTHON_BIN),
// então a importação de extratos funciona em qualquer PC, sem internet e sem
// o usuário instalar nada. Antes, o app dependia do Python do PC e de alguém
// rodar `pip install pdfplumber` nele — sem isso o extrator saía com código 1.
//
// O zip baixado fica em cache (electron/resources/.cache/); a pasta python/ é
// recriada do zero a cada build, para refletir o requirements atual.

import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const RESOURCES_DIR = path.join(ROOT, "electron", "resources");
const CACHE_DIR = path.join(RESOURCES_DIR, ".cache");
const PYTHON_DIR = path.join(RESOURCES_DIR, "python");
const SITE_PACKAGES = path.join(PYTHON_DIR, "Lib", "site-packages");
const REQUIREMENTS = path.join(ROOT, "scripts", "requirements-extratos.txt");

// Para trocar a versão, mude só aqui (os wheels são baixados para essa versão).
const PYTHON_VERSION = "3.12.7";
const PY_TAG = PYTHON_VERSION.split(".").slice(0, 2).join(""); // "312"
const ZIP_NAME = `python-${PYTHON_VERSION}-embed-amd64.zip`;
const ZIP_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/${ZIP_NAME}`;
const MIN_ZIP_BYTES = 5 * 1024 * 1024; // o zip real tem ~10MB; abaixo disso é página de erro

async function downloadEmbeddableZip() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const dest = path.join(CACHE_DIR, ZIP_NAME);
  if (existsSync(dest) && statSync(dest).size > MIN_ZIP_BYTES) return dest;

  console.log(`Baixando Python ${PYTHON_VERSION} embeddable do python.org...\n${ZIP_URL}`);
  const res = await fetch(ZIP_URL);
  if (!res.ok || !res.body) throw new Error(`Falha ao baixar o Python embeddable: HTTP ${res.status}`);
  const tmp = `${dest}.download`;
  await pipeline(res.body, createWriteStream(tmp));
  if (statSync(tmp).size < MIN_ZIP_BYTES) {
    unlinkSync(tmp);
    throw new Error("Download do Python embeddable incompleto ou inválido.");
  }
  renameSync(tmp, dest);
  return dest;
}

function extract(zipPath) {
  rmSync(PYTHON_DIR, { recursive: true, force: true });
  mkdirSync(PYTHON_DIR, { recursive: true });
  // tar.exe nativo do Windows (bsdtar) abre .zip; o tar do Git Bash não.
  const windowsTar = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "tar.exe");
  execFileSync(windowsTar, ["-xf", zipPath, "-C", PYTHON_DIR], { stdio: "inherit" });
}

function enableSitePackages() {
  // O embeddable ignora PYTHONPATH e só enxerga o que está no arquivo ._pth.
  const pthFile = path.join(PYTHON_DIR, `python${PY_TAG}._pth`);
  const lines = readFileSync(pthFile, "utf8").split(/\r?\n/).filter(Boolean);
  if (!lines.includes("Lib\\site-packages")) lines.splice(lines.indexOf("."), 0, "Lib\\site-packages");
  writeFileSync(pthFile, `${lines.join("\r\n")}\r\n`);
}

function installRequirements() {
  mkdirSync(SITE_PACKAGES, { recursive: true });
  // Usa o pip do Python da máquina de build para baixar wheels feitos para o
  // Python embutido (cp312, Windows 64-bit) — o embeddable não traz pip.
  const hostPython = process.env.BUILD_PYTHON || "python";
  execFileSync(
    hostPython,
    [
      "-m", "pip", "install",
      "--disable-pip-version-check", "--no-warn-script-location", "--no-compile",
      "--only-binary=:all:",
      "--platform", "win_amd64",
      "--python-version", PYTHON_VERSION.split(".").slice(0, 2).join("."),
      "--implementation", "cp",
      "--target", SITE_PACKAGES,
      "-r", REQUIREMENTS,
    ],
    { stdio: "inherit" },
  );
}

function smokeTest() {
  const python = path.join(PYTHON_DIR, "python.exe");
  const output = execFileSync(python, ["-c", "import sys, pdfplumber; print(sys.version.split()[0], pdfplumber.__version__)"], {
    encoding: "utf8",
  }).trim();
  console.log(`Python embutido OK: Python ${output.replace(" ", " + pdfplumber ")}`);
}

export async function preparePython() {
  const zip = await downloadEmbeddableZip();
  extract(zip);
  enableSitePackages();
  installRequirements();
  smokeTest();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  preparePython().catch((error) => {
    console.error(`\nFalha ao montar o Python embutido: ${error.message}`);
    process.exit(1);
  });
}
