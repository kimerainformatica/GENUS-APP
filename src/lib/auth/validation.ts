export function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalizeEmail(value: unknown): string {
  return cleanText(value, 254).toLowerCase();
}

export function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function passwordError(password: string): string | null {
  if (password.length < 10) return "A senha deve ter pelo menos 10 caracteres.";
  if (password.length > 128) return "A senha excede o limite permitido.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^\w\s]/.test(password)) {
    return "Use letras maiúsculas e minúsculas, número e caractere especial.";
  }
  return null;
}
