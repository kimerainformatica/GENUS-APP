import "server-only";

import { randomInt } from "node:crypto";
import bcrypt from "bcrypt";

// Sem 0/O, 1/I/L e U: o código é copiado à mão de um papel.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUPS = 4;
const GROUP_SIZE = 5;

/** Código de recuperação de administrador, ex.: "7KQ2M-X9DPA-4HTRW-ZC8NE" (~98 bits). */
export function generateRecoveryCode(): string {
  return Array.from({ length: GROUPS }, () =>
    Array.from({ length: GROUP_SIZE }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""),
  ).join("-");
}

/** Aceita o código digitado com ou sem traços/espaços e em minúsculas. */
export function normalizeRecoveryCode(value: unknown): string {
  return typeof value === "string" ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, GROUPS * GROUP_SIZE) : "";
}

export function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash(normalizeRecoveryCode(code), 12);
}

export function verifyRecoveryCode(code: string, hash: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(code);
  if (normalized.length !== GROUPS * GROUP_SIZE) return Promise.resolve(false);
  return bcrypt.compare(normalized, hash);
}
