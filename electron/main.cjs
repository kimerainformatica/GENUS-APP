// Processo principal do Electron: sobe o servidor Next.js standalone como um
// processo filho (rodando dentro do próprio binário do Electron, via
// ELECTRON_RUN_AS_NODE — não é preciso empacotar um Node.js separado) e abre
// uma janela apontando para ele. Cuida também de:
//   - inicializar o banco do usuário a partir do template na primeira vez
//     que o app roda (em %APPDATA%/Genus Contabilidade/genus.db, fora da
//     pasta de instalação — assim funciona mesmo com o .exe rodando de um
//     local só leitura);
//   - detectar se o Python está instalado (necessário para importar extratos
//     em PDF) e, se não estiver, oferecer para abrir o instalador oficial
//     empacotado junto do app.

const { app, BrowserWindow, dialog, shell } = require("electron");
const { spawn, execFileSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const http = require("node:http");

const PROJECT_ROOT = path.join(__dirname, "..");
const IS_PACKAGED = app.isPackaged;
const RESOURCES_BASE = IS_PACKAGED ? process.resourcesPath : PROJECT_ROOT;

// "runtime" é um nível de pasta extra de propósito — ver comentário em
// scripts/electron/prepare-resources.mjs sobre o filtro do electron-builder
// que descarta um node_modules colado direto na raiz do extraResources.
const SERVER_DIR = IS_PACKAGED
  ? path.join(RESOURCES_BASE, "app-server", "runtime")
  : path.join(PROJECT_ROOT, "electron", "resources", "app-server", "runtime");
const TEMPLATE_DB_PATH = IS_PACKAGED
  ? path.join(RESOURCES_BASE, "template.db")
  : path.join(PROJECT_ROOT, "electron", "resources", "template.db");
const PYTHON_INSTALLER_PATH = IS_PACKAGED
  ? path.join(RESOURCES_BASE, "python-installer.exe")
  : path.join(PROJECT_ROOT, "electron", "resources", "python-installer.exe");

let serverProcess = null;
let mainWindow = null;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      srv.close(() => resolve(address.port));
    });
  });
}

function ensureUserDb() {
  const userDataDir = app.getPath("userData");
  fs.mkdirSync(userDataDir, { recursive: true });
  const dbPath = path.join(userDataDir, "genus.db");
  if (!fs.existsSync(dbPath)) {
    if (!fs.existsSync(TEMPLATE_DB_PATH)) {
      throw new Error(
        `Banco template não encontrado em ${TEMPLATE_DB_PATH}. Rode "npm run electron:prepare" antes de empacotar o app.`,
      );
    }
    fs.copyFileSync(TEMPLATE_DB_PATH, dbPath);
  }
  return dbPath;
}

function detectPython() {
  const candidates = process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"];
  for (const bin of candidates) {
    try {
      execFileSync(bin, ["--version"], { stdio: "ignore", windowsHide: true });
      return bin;
    } catch {
      continue;
    }
  }
  return null;
}

async function runPythonInstaller() {
  await dialog.showMessageBox({
    type: "info",
    title: "Instalador do Python",
    message: 'O instalador oficial do python.org vai abrir agora.',
    detail: 'Marque a opção "Add python.exe to PATH" durante a instalação — sem ela o Genus Contabilidade não vai encontrar o Python depois.',
    buttons: ["OK"],
  });
  await new Promise((resolve) => {
    const child = spawn(PYTHON_INSTALLER_PATH, [], { detached: true, stdio: "ignore" });
    child.on("exit", resolve);
    child.on("error", resolve);
    child.unref();
  });
}

/** Verifica o Python e, se faltar, oferece instalar. Nunca bloqueia o app: a importação de extratos é a única funcionalidade que depende disso. */
async function ensurePython() {
  const found = detectPython();
  if (found) return found;

  const hasInstaller = fs.existsSync(PYTHON_INSTALLER_PATH);
  const { response } = await dialog.showMessageBox({
    type: "warning",
    title: "Python não encontrado",
    message: "O Genus Contabilidade usa o Python para importar extratos em PDF, e ele não foi encontrado nesta máquina.",
    detail:
      "O resto do app funciona normalmente sem o Python — só a importação de extratos vai ficar indisponível até ele ser instalado.",
    buttons: hasInstaller ? ["Instalar Python agora", "Continuar sem instalar"] : ["Abrir página de download", "Continuar sem instalar"],
    defaultId: 0,
    cancelId: 1,
  });

  if (response !== 0) return null;

  if (hasInstaller) {
    await runPythonInstaller();
  } else {
    shell.openExternal("https://www.python.org/downloads/windows/");
    return null;
  }

  const foundAfter = detectPython();
  await dialog.showMessageBox({
    type: foundAfter ? "info" : "warning",
    title: "Verificação do Python",
    message: foundAfter
      ? "Python encontrado! A importação de extratos já deve funcionar."
      : "Ainda não encontrei o Python instalado. Se a instalação pediu para reiniciar, feche e abra o Genus Contabilidade de novo.",
    buttons: ["OK"],
  });
  return foundAfter;
}

function waitForServer(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/login", timeout: 1500 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error("Tempo esgotado esperando o servidor interno responder."));
        else setTimeout(tryOnce, 300);
      });
      req.on("timeout", () => req.destroy());
    };
    tryOnce();
  });
}

async function startServer() {
  if (!fs.existsSync(path.join(SERVER_DIR, "server.js"))) {
    throw new Error(`Servidor não encontrado em ${SERVER_DIR}. Rode "npm run build" e "npm run electron:prepare" antes.`);
  }

  const dbPath = ensureUserDb();
  const pythonBin = (await ensurePython()) || "python";
  const port = await getFreePort();

  serverProcess = spawn(process.execPath, [path.join(SERVER_DIR, "server.js")], {
    cwd: SERVER_DIR,
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: `file:${dbPath}`,
      PYTHON_BIN: pythonBin,
    },
  });

  serverProcess.stdout?.on("data", (chunk) => console.log(`[server] ${chunk}`.trimEnd()));
  serverProcess.stderr?.on("data", (chunk) => console.error(`[server] ${chunk}`.trimEnd()));
  serverProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      dialog.showErrorBox("Genus Contabilidade", `O servidor interno encerrou inesperadamente (código ${code}).`);
    }
  });

  await waitForServer(port);
  return port;
}

async function createWindow() {
  let port;
  try {
    port = await startServer();
  } catch (error) {
    dialog.showErrorBox("Genus Contabilidade", `Não foi possível iniciar o app:\n${error.message}`);
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: "Genus Contabilidade",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) serverProcess.kill();
});
