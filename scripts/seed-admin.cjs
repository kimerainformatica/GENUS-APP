/* eslint-disable @typescript-eslint/no-require-imports */

const { randomUUID } = require("node:crypto");
const path = require("node:path");

const bcrypt = require("bcrypt");
const Database = require("better-sqlite3");

const email = process.env.TASK_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.TASK_ADMIN_PASSWORD;
const name = process.env.TASK_ADMIN_NAME?.trim() || "Administrador";

if (!email || !password) {
  throw new Error("Defina TASK_ADMIN_EMAIL e TASK_ADMIN_PASSWORD antes de executar o seed.");
}

const database = new Database(path.resolve(process.cwd(), "dev.db"));
const existingUser = database.prepare("SELECT id FROM Usuario WHERE email = ?").get(email);
const passwordHash = bcrypt.hashSync(password, 12);
const now = new Date().toISOString();

if (existingUser) {
  database
    .prepare("UPDATE Usuario SET senhaHash = ?, role = ?, ativo = ?, updatedAt = ? WHERE id = ?")
    .run(passwordHash, "ADMIN", 1, now, existingUser.id);
  console.log("Administrador atualizado.");
} else {
  database
    .prepare(
      "INSERT INTO Usuario (id, nome, email, senhaHash, role, ativo, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(randomUUID(), name, email, passwordHash, "ADMIN", 1, now, now);
  console.log("Administrador criado.");
}

database.close();
