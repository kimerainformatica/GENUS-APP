// Prepara tudo que o electron-builder precisa empacotar, depois de
// "next build --webpack" (o --webpack importa: o build padrão usa Turbopack,
// que embute o caminho absoluto da máquina que gerou o build dentro de
// server.js para resolver módulos nativos externos — quebra assim que a
// pasta .next/standalone é copiada para dentro do .exe, em outra máquina):
//   1. copia .next/standalone inteiro para electron/resources/app-server/runtime/
//      — não dá pra apontar o electron-builder direto pra .next/standalone:
//      o `createFilter` interno do electron-builder (app-builder-lib/out/util/filter.js)
//      SEMPRE exclui uma pasta chamada exatamente "node_modules" quando ela é
//      filha direta da raiz copiada (é a regra que ele usa pra "eu cuido dos
//      seus node_modules" no "files" principal do app). Isso apaga o
//      node_modules inteiro do standalone silenciosamente. Colocando um nível
//      extra de pasta ("runtime/") no meio, o node_modules deixa de ser filho
//      direto da origem e a regra não bate mais;
//   2. copia .next/static e public/ para dentro dessa cópia (exigido pelo modo
//      "standalone" do Next.js — ver docs de output: "standalone");
//   3. recompila o binário nativo do better-sqlite3 dentro do node_modules
//      copiado para o ABI do Electron empacotado — o Node do projeto e o Node
//      embutido no Electron são versões diferentes, então o .node compilado
//      para um não carrega no outro (erro ERR_DLOPEN_FAILED / NODE_MODULE_VERSION).
//      Isso só afeta essa CÓPIA; o node_modules do projeto continua intacto
//      para dev/build/test normais. O bcrypt não precisa disso (é N-API,
//      estável entre versões);
//   4. gera electron/resources/template.db: um SQLite com o schema do Prisma
//      já aplicado (via `prisma migrate deploy`) e zero dados — é a cópia que
//      o app usa para inicializar o banco do usuário no primeiro uso;
//   5. garante que o instalador do Python foi baixado (delega para
//      download-python-installer.mjs).

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const STANDALONE_SRC = path.join(ROOT, ".next", "standalone");
const RESOURCES_DIR = path.join(ROOT, "electron", "resources");
const APP_SERVER_DIR = path.join(RESOURCES_DIR, "app-server");
const RUNTIME_DIR = path.join(APP_SERVER_DIR, "runtime");
const ELECTRON_VERSION = execFileSync(process.execPath, ["-p", "require('electron/package.json').version"], { cwd: ROOT })
  .toString()
  .trim();

function step(title) {
  console.log(`\n> ${title}`);
}

function copyRuntimeBundle() {
  step("Copiando .next/standalone para electron/resources/app-server/runtime (nível extra p/ escapar do filtro do electron-builder)");
  if (!existsSync(STANDALONE_SRC)) {
    throw new Error(`${STANDALONE_SRC} não existe. Rode "next build --webpack" antes.`);
  }
  rmSync(APP_SERVER_DIR, { recursive: true, force: true });
  mkdirSync(RUNTIME_DIR, { recursive: true });
  cpSync(STANDALONE_SRC, RUNTIME_DIR, { recursive: true });
  // .env não é necessário em runtime (electron/main.cjs passa todo env explicitamente)
  // e não faz sentido distribuir o .env de desenvolvimento dentro do .exe.
  rmSync(path.join(RUNTIME_DIR, ".env"), { force: true });

  cpSync(path.join(ROOT, ".next", "static"), path.join(RUNTIME_DIR, ".next", "static"), { recursive: true });
  cpSync(path.join(ROOT, "public"), path.join(RUNTIME_DIR, "public"), { recursive: true });
}

function rebuildNativeModulesForElectron() {
  step(`Recompilando better-sqlite3 para o ABI do Electron ${ELECTRON_VERSION} (só na cópia em app-server/runtime)`);
  const moduleDir = path.join(RUNTIME_DIR, "node_modules", "better-sqlite3");
  if (!existsSync(moduleDir)) {
    console.warn(`AVISO: ${moduleDir} não existe — pulei a recompilação (build normal sem better-sqlite3?).`);
    return;
  }
  rmSync(path.join(moduleDir, "build"), { recursive: true, force: true });
  const prebuildInstall = path.join(ROOT, "node_modules", "prebuild-install", "bin.js");
  execFileSync(
    process.execPath,
    [prebuildInstall, "--runtime=electron", `--target=${ELECTRON_VERSION}`, "--arch=x64", "--platform=win32"],
    { cwd: moduleDir, stdio: "inherit" },
  );
}

function buildTemplateDb() {
  step("Gerando electron/resources/template.db (schema limpo, sem dados)");
  mkdirSync(RESOURCES_DIR, { recursive: true });
  const templateDb = path.join(RESOURCES_DIR, "template.db");
  rmSync(templateDb, { force: true });
  rmSync(`${templateDb}-journal`, { force: true });

  const prismaCli = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", path.join(ROOT, "prisma", "schema.prisma")], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: `file:${templateDb}` },
    stdio: "inherit",
  });
  console.log(`Template gerado em ${templateDb}`);
}

function ensurePythonInstaller() {
  step("Garantindo instalador do Python em electron/resources/");
  try {
    execFileSync(process.execPath, [path.join(__dirname, "download-python-installer.mjs")], {
      cwd: ROOT,
      stdio: "inherit",
    });
  } catch {
    console.warn(
      "\nAVISO: não foi possível baixar o instalador do Python agora (sem internet?). " +
        "O .exe ainda funciona, mas o botão \"Instalar Python\" ficará indisponível até o " +
        "arquivo existir em electron/resources/python-installer.exe.",
    );
  }
}

function main() {
  copyRuntimeBundle();
  rebuildNativeModulesForElectron();
  buildTemplateDb();
  ensurePythonInstaller();
  console.log("\nRecursos prontos para o electron-builder (npm run electron:dist).");
}

try {
  main();
} catch (error) {
  console.error("\nFalha ao preparar recursos:", error.message);
  process.exit(1);
}
