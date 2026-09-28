// Atualiza o banco do usuário (%APPDATA%/.../genus.db) para o schema da
// versão do app que está abrindo, sem perder dados. Roda a cada abertura do
// app, antes do servidor subir:
//
//   1. confere a integridade do arquivo (PRAGMA integrity_check);
//   2. compara as migrations empacotadas com as já aplicadas, lendo a mesma
//      tabela de controle que o Prisma usa (_prisma_migrations) e o mesmo
//      checksum (sha256 do migration.sql) — o banco continua 100% compatível
//      com `prisma migrate` fora do app;
//   3. se houver migration pendente, faz um BACKUP completo antes de tocar em
//      qualquer coisa (mantém os últimos MAX_BACKUPS em /backups);
//   4. aplica cada migration pendente numa transação própria e confere as
//      foreign keys antes do COMMIT — se qualquer passo falhar, aquela
//      migration inteira é desfeita (ROLLBACK) e o app não abre com um banco
//      pela metade.
//
// Também recusa abrir um banco que já recebeu migrations que este .exe não
// conhece (alguém abriu um .exe mais ANTIGO depois de um mais novo): o código
// antigo não sabe lidar com o schema novo e poderia gravar dados errados.
//
// Sem dependência de Electron aqui, para poder ser testado com Node puro.

/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MAX_BACKUPS = 10;

class MigrationError extends Error {}

function listBundledMigrations(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) {
    throw new MigrationError(`Pasta de migrations não encontrada em ${migrationsDir}.`);
  }
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(migrationsDir, entry.name, "migration.sql")))
    .map((entry) => entry.name)
    .sort()
    .map((name) => {
      const sql = fs.readFileSync(path.join(migrationsDir, name, "migration.sql"));
      return { name, sql: sql.toString("utf8"), checksum: crypto.createHash("sha256").update(sql).digest("hex") };
    });
}

function ensureMigrationsTable(db) {
  // Mesma definição que o Prisma cria — um banco novo criado do zero aqui
  // continua reconhecível pelo `prisma migrate status`.
  db.exec(`CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
  )`);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function pruneBackups(backupsDir) {
  const files = fs
    .readdirSync(backupsDir)
    .filter((file) => file.endsWith(".db"))
    .map((file) => ({ file, mtime: fs.statSync(path.join(backupsDir, file)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  for (const { file } of files.slice(MAX_BACKUPS)) fs.rmSync(path.join(backupsDir, file), { force: true });
}

async function backupDb(db, backupsDir, label) {
  fs.mkdirSync(backupsDir, { recursive: true });
  const target = path.join(backupsDir, `genus-${timestamp()}-${label}.db`);
  // API de backup online do SQLite: cópia consistente mesmo com WAL/journal.
  await db.backup(target);
  pruneBackups(backupsDir);
  return target;
}

function applyMigration(db, migration) {
  const startedAt = Date.now();
  // PRAGMA foreign_keys não muda dentro de transação; as migrations do
  // Prisma para SQLite recriam tabelas ("RedefineTables") e precisam das FKs
  // desligadas durante a troca. Conferimos as FKs manualmente antes do COMMIT.
  db.pragma("foreign_keys = OFF");
  try {
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(migration.sql);
      const violations = db.pragma("foreign_key_check");
      if (violations.length > 0) {
        throw new MigrationError(`a migration deixaria ${violations.length} referência(s) quebrada(s) entre tabelas`);
      }
      db.prepare(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`,
      ).run(crypto.randomUUID(), migration.checksum, Date.now(), migration.name, startedAt);
      db.exec("COMMIT");
    } catch (error) {
      if (db.inTransaction) db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

/**
 * @param {object} options
 * @param {string} options.dbPath
 * @param {string} options.migrationsDir
 * @param {string} options.backupsDir
 * @param {string} options.appVersion usado só no nome do backup
 * @param {typeof import("better-sqlite3")} options.Database
 * @param {(message: string) => void} [options.log]
 * @returns {Promise<{ applied: string[], backupPath: string | null }>}
 */
async function migrateUserDb({ dbPath, migrationsDir, backupsDir, appVersion, Database, log = () => {} }) {
  const bundled = listBundledMigrations(migrationsDir);
  const db = new Database(dbPath);
  try {
    const integrity = db.pragma("integrity_check", { simple: true });
    if (integrity !== "ok") {
      throw new MigrationError(`O arquivo do banco está corrompido (${integrity}). Restaure um backup da pasta "${backupsDir}".`);
    }

    ensureMigrationsTable(db);
    const rows = db.prepare(`SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations"`).all();

    const unfinished = rows.filter((row) => row.finished_at === null && row.rolled_back_at === null);
    if (unfinished.length > 0) {
      throw new MigrationError(
        `Uma atualização anterior do banco não terminou (${unfinished.map((row) => row.migration_name).join(", ")}). ` +
          `Restaure o backup mais recente da pasta "${backupsDir}".`,
      );
    }

    const applied = new Map(rows.filter((row) => row.finished_at !== null && row.rolled_back_at === null).map((row) => [row.migration_name, row]));
    const bundledNames = new Set(bundled.map((migration) => migration.name));
    const unknown = [...applied.keys()].filter((name) => !bundledNames.has(name));
    if (unknown.length > 0) {
      throw new MigrationError(
        "Este banco já foi atualizado por uma versão MAIS NOVA do Genus Contabilidade. " +
          "Abra a versão mais recente do programa — esta versão antiga poderia gravar dados incompatíveis.",
      );
    }

    for (const migration of bundled) {
      const row = applied.get(migration.name);
      if (row && row.checksum !== migration.checksum) {
        // Migration já aplicada foi editada depois de publicada. Não
        // reaplicamos (ela já rodou), só registramos — editar migration
        // publicada é proibido pelo processo de release (ver electron/README.md).
        log(`AVISO: a migration ${migration.name} foi alterada depois de aplicada (checksum diferente).`);
      }
    }

    const pending = bundled.filter((migration) => !applied.has(migration.name));
    if (pending.length === 0) return { applied: [], backupPath: null };

    const isFreshDb = applied.size === 0;
    const backupPath = isFreshDb ? null : await backupDb(db, backupsDir, `antes-v${appVersion}`);
    if (backupPath) log(`Backup do banco criado em ${backupPath}`);

    for (const migration of pending) {
      log(`Aplicando migration ${migration.name}...`);
      try {
        applyMigration(db, migration);
      } catch (error) {
        throw new MigrationError(
          `Falha ao atualizar o banco na etapa "${migration.name}": ${error.message}. ` +
            "Nenhum dado foi perdido: essa etapa foi desfeita" +
            (backupPath ? ` e há um backup completo em "${backupPath}".` : "."),
        );
      }
    }
    return { applied: pending.map((migration) => migration.name), backupPath };
  } finally {
    db.close();
  }
}

module.exports = { migrateUserDb, listBundledMigrations, MigrationError };
