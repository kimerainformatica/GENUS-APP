// Trava de segurança para atualizações do .exe: toda migration nova roda
// sozinha no banco real da empresa na próxima abertura do app, então aqui
// barramos (antes de empacotar) o que pode perder ou corromper dados:
//
//   - DROP TABLE, DROP COLUMN, RENAME, DELETE FROM, UPDATE — só passam se o
//     migration.sql tiver a linha `-- genus:revisado` (sinal de que alguém
//     conferiu que os dados são preservados/copiados antes). Isso inclui o
//     padrão "RedefineTables" que o Prisma gera no SQLite ao mudar o tipo de
//     uma coluna: ele copia os dados, mas descarta em silêncio as colunas que
//     saíram do schema;
//   - ADD COLUMN ... NOT NULL sem DEFAULT — o SQLite recusa em tabela que já
//     tem linhas, ou seja, quebraria justamente no banco de quem já usa o app;
//   - migration já commitada que foi editada — ela pode já ter rodado em
//     algum cliente; mudança de schema tem que ser uma migration NOVA.
//
// Uso: node scripts/check-migrations.mjs   (roda sozinho no electron:prepare)

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_DIR = path.join(ROOT, "prisma", "migrations");
const REVIEW_MARKER = "-- genus:revisado";
// Migrations publicadas antes desta verificação existir (já estão nos bancos
// em uso e não podem mais ser editadas nem para receber o marcador).
const BASELINE = "20260914000000_add_usuario_role";

function statements(sql) {
  return sql
    .replace(/--.*$/gm, "")
    .split(";")
    .map((statement) => statement.replace(/\s+/g, " ").trim().toUpperCase())
    .filter(Boolean);
}

function destructiveReason(statement) {
  if (/^DROP (TABLE|VIEW)\b/.test(statement)) return "apaga uma tabela";
  if (/^ALTER TABLE .* DROP COLUMN\b/.test(statement)) return "apaga uma coluna";
  if (/^ALTER TABLE .* RENAME\b/.test(statement)) return "renomeia tabela/coluna";
  if (/^DELETE FROM\b/.test(statement)) return "apaga linhas";
  if (/^UPDATE\b/.test(statement)) return "reescreve dados existentes";
  return null;
}

function breaksExistingRows(statement) {
  return /^ALTER TABLE .* ADD COLUMN .* NOT NULL\b/.test(statement) && !/\bDEFAULT\b/.test(statement);
}

function editedCommittedMigrations() {
  try {
    const output = execFileSync("git", ["diff", "--name-status", "HEAD", "--", "prisma/migrations"], { cwd: ROOT, encoding: "utf8" });
    return output
      .split("\n")
      .filter((line) => /^[MDR]/.test(line) && line.includes("migration.sql"))
      .map((line) => line.split(/\s+/).pop());
  } catch {
    console.warn("AVISO: git indisponível — pulei a checagem de migrations editadas.");
    return [];
  }
}

const problems = [];

for (const file of editedCommittedMigrations()) {
  problems.push(`${file}: migration já commitada foi alterada/apagada. Crie uma migration nova em vez de editar uma publicada.`);
}

const names = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(path.join(MIGRATIONS_DIR, entry.name, "migration.sql")))
  .map((entry) => entry.name)
  .sort();

for (const name of names.filter((migration) => migration > BASELINE)) {
  const sql = readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
  const reviewed = sql.includes(REVIEW_MARKER);
  for (const statement of statements(sql)) {
    if (breaksExistingRows(statement)) {
      problems.push(`${name}: coluna NOT NULL sem DEFAULT quebra em tabelas que já têm dados → "${statement.slice(0, 120)}"`);
    }
    const reason = destructiveReason(statement);
    if (reason && !reviewed) {
      problems.push(`${name}: ${reason} → "${statement.slice(0, 120)}". Se os dados estão preservados, adicione a linha "${REVIEW_MARKER}" ao migration.sql.`);
    }
  }
}

if (problems.length > 0) {
  console.error("\nMigrations inseguras para atualizar o banco de quem já usa o app:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error("\nVeja \"Atualizações e banco de dados\" em electron/README.md.\n");
  process.exit(1);
}

console.log(`OK: ${names.length} migration(s) verificada(s), nenhuma operação insegura.`);
