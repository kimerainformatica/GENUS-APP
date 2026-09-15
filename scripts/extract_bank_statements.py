#!/usr/bin/env python3
"""Extrai cabeçalho e transações de extratos PDF brasileiros.

Uso:
    python scripts/extract_bank_statements.py extrato.pdf --output-dir saida

O JSON contém o texto bruto por página e blocos não classificados. Assim, toda
informação do PDF permanece auditável mesmo quando o layout de um banco mudar.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
from dataclasses import asdict, dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable

try:
    import pdfplumber
except ImportError as error:  # pragma: no cover - depends on local installation
    raise SystemExit("Instale a dependência: pip install -r scripts/requirements-extratos.txt") from error


MONEY_PATTERN = re.compile(
    r"(?<!\d)(?P<sign>[-+])?\s*(?:R\$\s*)?(?P<number>\(?\s*\d{1,3}(?:\.\d{3})*,\d{2}\s*\)?)"
)
DATE_PATTERN = re.compile(r"(?<!\d)(?P<day>0[1-9]|[12]\d|3[01])/(?P<month>0[1-9]|1[0-2])(?:/(?P<year>20\d{2}))?(?!\d)")
IDENTIFIER_PATTERN = re.compile(
    r"\b(?:(?:ID|E2E|END\s*TO\s*END|AUT(?:ENTICA[CÇ][AÃ]O)?|NSU|DOC(?:UMENTO)?|TRANSAC[AÃ]O)\s*[:#-]?\s*)([A-Za-z0-9._/-]{6,})",
    re.IGNORECASE,
)


@dataclass
class Transaction:
    data: str | None
    tipo: str
    descricao: str
    identificador: str | None
    valor: Decimal | None
    saldo_apos: Decimal | None
    pagina_origem: int
    texto_original: str
    classificacao_confiavel: bool


@dataclass
class ExtractionResult:
    cabecalho: dict[str, object]
    transacoes: list[Transaction] = field(default_factory=list)
    blocos_sem_valor: list[dict[str, object]] = field(default_factory=list)
    texto_bruto_por_pagina: list[dict[str, object]] = field(default_factory=list)


def fold(value: str) -> str:
    """Normaliza acentos para comparar rótulos, sem alterar o texto exportado."""
    return "".join(
        character
        for character in unicodedata.normalize("NFD", value).lower()
        if unicodedata.category(character) != "Mn"
    )


def clean_line(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def parse_money(value: str) -> Decimal:
    normalized = value.strip().replace("R$", "").replace(" ", "")
    is_parenthesized = normalized.startswith("(") and normalized.endswith(")")
    normalized = normalized.strip("()").replace(".", "").replace(",", ".")
    try:
        amount = Decimal(normalized)
    except InvalidOperation as error:
        raise ValueError(f"Valor monetário inválido: {value!r}") from error
    return -amount if is_parenthesized else amount


def money_matches(value: str) -> list[tuple[Decimal, int, int, str]]:
    matches: list[tuple[Decimal, int, int, str]] = []
    for match in MONEY_PATTERN.finditer(value):
        raw = match.group(0)
        amount = parse_money(match.group("number"))
        if match.group("sign") == "-":
            amount = -abs(amount)
        elif match.group("sign") == "+":
            amount = abs(amount)
        matches.append((amount, match.start(), match.end(), raw))
    return matches


def detect_bank(text: str) -> str | None:
    normalized = fold(text)
    signatures = {
        "PicPay": ("picpay",),
        "Mercado Pago": ("mercado pago", "mercadopago"),
        "Nubank": ("nubank",),
        "Banco Inter": ("banco inter", "inter&co", "inter medium"),
        "Itaú": ("itau.com.br", "banco itau", "itau unibanco"),
    }
    for bank, terms in signatures.items():
        if any(term in normalized for term in terms):
            return bank
    return None


def first_group(patterns: Iterable[str], text: str, flags: int = re.IGNORECASE) -> str | None:
    for pattern in patterns:
        match = re.search(pattern, text, flags)
        if match:
            return clean_line(match.group(1))
    return None


def labeled_amount(text: str, labels: Iterable[str]) -> Decimal | None:
    for label in labels:
        same_line = re.search(rf"{label}[^\n]{{0,80}}", text, re.IGNORECASE)
        if same_line:
            values = money_matches(same_line.group(0))
            if values:
                return values[-1][0]
        # Em PDFs de coluna quebrada o rótulo fica numa linha ("Saldo total
        # Limite da conta ...") e os valores na linha seguinte, na mesma
        # ordem dos rótulos — por isso pegamos o primeiro valor dessa linha.
        next_line = re.search(rf"{label}[^\n]*\n([^\n]{{0,80}})", text, re.IGNORECASE)
        if next_line:
            values = money_matches(next_line.group(1))
            if values:
                return values[0][0]
    return None


def parse_header(full_text: str) -> dict[str, object]:
    lines = full_text.splitlines()
    preview = "\n".join(lines[:80])
    # O sinal do banco e o saldo "anterior" podem aparecer fora das primeiras
    # linhas (ex.: no rodapé ou junto do lançamento mais antigo do período),
    # então essas duas buscas olham o documento inteiro.
    bank = detect_bank(full_text)
    cpf_cnpj = first_group(
        [r"\b(?:CPF|CNPJ)\s*[:.]?\s*([\d./-]{11,18})"], preview
    )
    holder = first_group(
        [
            r"(?:titular|cliente|razao social|nome)\s*[:.]?\s*([^\n]{3,120})",
            r"(?:conta de|extrato de)\s+([^\n]{3,120})",
        ],
        preview,
    )
    agency = first_group([r"(?:ag[eê]ncia|ag\.)\s*[:.]?\s*([\d-]{2,12})"], preview)
    account = first_group(
        [r"(?:conta|c/c)\s*(?:corrente)?\s*[:.]?\s*([\d.-]{3,24})"], preview
    )

    return {
        "instituicao": bank,
        "titular_razao_social": holder,
        "cpf_cnpj": cpf_cnpj,
        "agencia": agency,
        "conta": account,
        "saldo_inicial": labeled_amount(full_text, (r"saldo\s+(?:inicial|anterior)",)),
        "total_entradas": labeled_amount(preview, (r"total\s+(?:de\s+)?(?:entradas|creditos)",)),
        "total_saidas": labeled_amount(preview, (r"total\s+(?:de\s+)?(?:saidas|debitos)",)),
        "rendimentos": labeled_amount(preview, (r"rendimentos?",)),
        "tributos_retidos": labeled_amount(preview, (r"(?:iof|irrf|imposto|tributos?)",)),
        "saldo_final": labeled_amount(preview, (r"saldo\s+(?:final|atual|disponivel|total)",)),
    }


def transaction_start(line: str) -> bool:
    # Uma linha só inicia um lançamento quando ela começa com a data. Contar
    # "exatamente uma data na linha" falha em extratos (ex.: Itaú) cujo
    # identificador de PIX embute um trecho parecido com data, como em
    # "PIX RECEBIDO MIRIA B09/07 ...": essa linha tem duas datas (a real e o
    # trecho do identificador) e seria descartada por engano.
    return DATE_PATTERN.match(line) is not None


def group_transaction_blocks(pages: list[str]) -> tuple[list[tuple[int, list[str]]], list[dict[str, object]]]:
    blocks: list[tuple[int, list[str]]] = []
    outside: list[dict[str, object]] = []
    current: list[str] = []
    current_page = 0

    def flush() -> None:
        nonlocal current
        if current:
            blocks.append((current_page, current))
            current = []

    for page_number, text in enumerate(pages, start=1):
        for original_line in text.splitlines():
            line = clean_line(original_line)
            if not line:
                continue
            if transaction_start(line):
                flush()
                current_page = page_number
                current = [line]
            elif current:
                current.append(line)
            else:
                outside.append({"pagina": page_number, "linha": line})
    flush()
    return blocks, outside


def transaction_type(text: str) -> tuple[str, int]:
    normalized = fold(text)
    rules = (
        ("PIX recebido", ("pix recebido", "pix recebido de", "recebimento pix"), 1),
        ("PIX enviado", ("pix enviado", "pix para", "pagamento pix", "transferencia pix"), -1),
        ("TED recebida", ("ted recebida", "credito ted"), 1),
        ("TED enviada", ("ted enviada", "debito ted"), -1),
        ("Pagamento de boleto", ("boleto", "pagamento de conta"), -1),
        ("Compra no cartão", ("compra", "cartao", "cartão"), -1),
        ("Tarifa bancária", ("tarifa", "taxa", "encargo"), -1),
        ("Rendimento", ("rendimento", "remuneracao", "remuneração"), 1),
        ("Estorno", ("estorno", "devolucao", "devolução"), 1),
        ("Saque", ("saque",), -1),
    )
    for name, terms, sign in rules:
        if any(term in normalized for term in terms):
            return name, sign
    return "Não classificado", 1


def parse_date(block: str, default_year: int) -> str | None:
    match = DATE_PATTERN.search(block)
    if not match:
        return None
    year = int(match.group("year") or default_year)
    try:
        return date(year, int(match.group("month")), int(match.group("day"))).isoformat()
    except ValueError:
        return None


def value_after_label(block: str, label: str) -> Decimal | None:
    match = re.search(rf"{label}[^\n]{{0,70}}", block, re.IGNORECASE)
    if not match:
        return None
    values = money_matches(match.group(0))
    return values[-1][0] if values else None


def parse_transaction(page: int, lines: list[str], default_year: int) -> Transaction:
    original = "\n".join(lines)
    merged = " ".join(lines)
    kind, expected_sign = transaction_type(merged)
    balances = [
        value_after_label(merged, label)
        for label in (r"saldo(?:\s+(?:apos|ap[oó]s|disponivel|final))?",)
    ]
    balance = next((item for item in balances if item is not None), None)
    values = money_matches(merged)

    # Em extratos tabulares a última coluna normalmente é o saldo. Quando ela
    # não vem rotulada, a primeira moeda é o lançamento e a última fica auditada
    # no texto original para conferência.
    amount = values[0][0] if values else None
    # Só corrigimos o sinal quando o tipo foi reconhecido com confiança; um
    # sinal explícito no texto (ex.: "-12,00") sempre prevalece sobre a
    # suposição padrão de lançamentos não classificados.
    if kind != "Não classificado" and amount is not None:
        if amount > 0 and expected_sign < 0:
            amount = -amount
        elif amount < 0 and expected_sign > 0:
            amount = abs(amount)

    identifier_match = IDENTIFIER_PATTERN.search(merged)
    description = DATE_PATTERN.sub("", merged, count=1)
    if amount is not None:
        description = description.replace(values[0][3], "", 1)
    if balance is not None:
        description = re.sub(r"saldo[^\n]{0,50}", "", description, flags=re.IGNORECASE)
    description = clean_line(description.strip(" -|;"))

    return Transaction(
        data=parse_date(merged, default_year),
        tipo=kind,
        descricao=description,
        identificador=identifier_match.group(1) if identifier_match else None,
        valor=amount,
        saldo_apos=balance,
        pagina_origem=page,
        texto_original=original,
        classificacao_confiavel=amount is not None and kind != "Não classificado",
    )


def extract_pdf_pages(path: Path) -> list[str]:
    with pdfplumber.open(path) as pdf:
        pages = [(page.extract_text(layout=True) or "").strip() for page in pdf.pages]
    if any(pages):
        return pages
    raise SystemExit(
        "O PDF não possui texto selecionável. Rode OCR antes da extração "
        "(por exemplo, OCRmyPDF com idioma por) e execute o script novamente."
    )


def decimal_json(value: object) -> object:
    if isinstance(value, Decimal):
        return float(value.quantize(Decimal("0.01")))
    raise TypeError(f"Tipo não serializável: {type(value)!r}")


def write_csv(transactions: list[Transaction], output: Path) -> None:
    fields = [
        "data", "tipo", "descricao", "identificador", "valor", "saldo_apos",
        "pagina_origem", "classificacao_confiavel", "texto_original",
    ]
    with output.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=fields, delimiter=";")
        writer.writeheader()
        for transaction in transactions:
            row = asdict(transaction)
            for field in ("valor", "saldo_apos"):
                if row[field] is not None:
                    row[field] = f"{row[field]:.2f}"
            writer.writerow(row)


def extract(path: Path, default_year: int) -> ExtractionResult:
    pages = extract_pdf_pages(path)
    full_text = "\n".join(pages)
    header = parse_header(full_text)
    blocks, outside = group_transaction_blocks(pages)
    transactions = [parse_transaction(page, lines, default_year) for page, lines in blocks]
    missing_amount = [
        {"pagina": transaction.pagina_origem, "texto_original": transaction.texto_original}
        for transaction in transactions
        if transaction.valor is None
    ]
    result = ExtractionResult(
        cabecalho=header,
        transacoes=transactions,
        blocos_sem_valor=outside + missing_amount,
        texto_bruto_por_pagina=[{"pagina": number, "texto": text} for number, text in enumerate(pages, 1)],
    )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path, help="Caminho do extrato em PDF")
    parser.add_argument("--output-dir", type=Path, default=Path("extracoes"))
    parser.add_argument("--year", type=int, default=2026, help="Ano para datas sem ano (padrão: 2026)")
    arguments = parser.parse_args()

    if not arguments.pdf.is_file():
        parser.error(f"Arquivo não encontrado: {arguments.pdf}")

    arguments.output_dir.mkdir(parents=True, exist_ok=True)
    result = extract(arguments.pdf, arguments.year)
    stem = arguments.pdf.stem
    json_path = arguments.output_dir / f"{stem}.json"
    csv_path = arguments.output_dir / f"{stem}-transacoes.csv"

    with json_path.open("w", encoding="utf-8") as file:
        json.dump(asdict(result), file, ensure_ascii=False, indent=2, default=decimal_json)
    write_csv(result.transacoes, csv_path)

    print(f"JSON: {json_path}")
    print(f"CSV:  {csv_path}")
    print(f"Transações encontradas: {len(result.transacoes)}")
    print(f"Blocos para conferência: {len(result.blocos_sem_valor)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
