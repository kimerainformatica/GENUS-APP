export function textField(value: FormDataEntryValue | null, label: string, options?: { required?: boolean; max?: number }): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (options?.required && !text) throw new Error(`${label} é obrigatório.`);
  if (text.length > (options?.max ?? 255)) throw new Error(`${label} excede o limite permitido.`);
  return text || null;
}

export function idField(value: FormDataEntryValue | null, label = "Identificador"): string {
  const id = textField(value, label, { required: true, max: 64 });
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error(`${label} inválido.`);
  return id;
}

export function optionalIdField(value: FormDataEntryValue | null): string | null {
  const id = textField(value, "Identificador", { max: 64 });
  if (id && !/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error("Identificador inválido.");
  return id;
}

export function moneyField(value: FormDataEntryValue | null, label: string, required = false): number | null {
  const raw = textField(value, label, { required, max: 40 });
  if (raw === null) return null;
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || Math.abs(parsed) > 999_999_999_999) throw new Error(`${label} inválido.`);
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

export function dateField(value: FormDataEntryValue | null, label: string, required = false): Date | null {
  const raw = textField(value, label, { required, max: 10 });
  if (raw === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${label} inválida.`);
  const date = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new Error(`${label} inválida.`);
  return date;
}

export function emailField(value: FormDataEntryValue | null): string | null {
  const email = textField(value, "E-mail", { max: 254 })?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("E-mail inválido.");
  return email;
}

function allSameDigits(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

function validCpf(value: string): boolean {
  if (value.length !== 11 || allSameDigits(value)) return false;
  const digit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) sum += Number(value[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}

function validCnpj(value: string): boolean {
  if (value.length !== 14 || allSameDigits(value)) return false;
  const calculate = (base: string) => {
    let weight = base.length - 7;
    const sum = [...base].reduce((total, char) => {
      const result = total + Number(char) * weight;
      weight = weight === 2 ? 9 : weight - 1;
      return result;
    }, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = calculate(value.slice(0, 12));
  const second = calculate(value.slice(0, 12) + first);
  return `${first}${second}` === value.slice(12);
}

export function cpfCnpjField(value: FormDataEntryValue | null): string | null {
  const raw = textField(value, "CPF/CNPJ", { max: 24 });
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!validCpf(digits) && !validCnpj(digits)) throw new Error("CPF/CNPJ inválido.");
  return digits.length === 11
    ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}
