import type { GenusTipoOperacao } from "@/lib/extratos/genus-extractor";

export const EXPENSE_CATEGORIES = [
  "Transferências PIX/TED",
  "Fornecedores e compras",
  "Tarifas bancárias",
  "Impostos e tributos",
  "Folha e pessoas",
  "Alimentação",
  "Transporte",
  "Moradia e serviços",
  "Saques",
  "Outros",
] as const;

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

export function classificarCategoria(tipoOperacao: GenusTipoOperacao | string | null, descricao: string): string {
  const text = descricao.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (includesAny(text, ["tarifa", "encargo", "iof", "juros", "manut.c/c"])) return "Tarifas bancárias";
  if (includesAny(text, ["darf", "das ", "imposto", "tributo", "inss", "fgts", "gps "])) return "Impostos e tributos";
  if (includesAny(text, ["salario", "folha", "pro labore", "adiantamento salarial"])) return "Folha e pessoas";
  if (includesAny(text, ["mercado", "supermercado", "restaurante", "lanchonete", "ifood", "padaria"])) return "Alimentação";
  if (includesAny(text, ["combustivel", "posto ", "uber", "99 ", "estacionamento", "passagem"])) return "Transporte";
  if (includesAny(text, ["aluguel", "condominio", "energia", "internet", "telefone", "agua "])) return "Moradia e serviços";
  if (text.includes("saque")) return "Saques";
  if (includesAny(text, ["boleto", "cartao", "compra", "fornecedor", "pag cobrança", "pag cobranca"])) return "Fornecedores e compras";
  if (tipoOperacao === "PIX_ENVIADO" || text.includes("pix") || text.includes("ted")) return "Transferências PIX/TED";
  return "Outros";
}
