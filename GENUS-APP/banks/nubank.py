"""Parser do extrato PF/PJ do Nubank.

Formato real (confirmado com extrato de 72 páginas): a data aparece só uma
vez por dia, como cabeçalho de seção ("01 JUL 2026 Total de entradas +
7.915,71"); todos os lançamentos abaixo dela herdam essa data até aparecer
"Total de saídas" (troca a seção para saídas), um novo cabeçalho de dia, ou
"Saldo do dia" (fecha o dia). O valor de cada lançamento vem no FINAL da
mesma linha em que ele começa ("Transferência recebida pelo Pix ... 716,00");
as linhas seguintes só completam a descrição (banco/agência/conta do
destinatário), sem novo valor.

Cada página repete um cabeçalho (titular, CNPJ, período terminando em
"VALORES EM R$") que precisa ser removido antes de juntar as linhas, senão
ele vaza para dentro da descrição do lançamento que ficou pendente no fim da
página anterior.
"""

from __future__ import annotations

import re

from .common import build_transacao, clean_line, fold, money_matches, montar_resultado

NUBANK_MESES = {
    "JAN": "01", "FEV": "02", "MAR": "03", "ABR": "04", "MAI": "05", "JUN": "06",
    "JUL": "07", "AGO": "08", "SET": "09", "OUT": "10", "NOV": "11", "DEZ": "12",
}

NUBANK_DIA_PATTERN = re.compile(
    r"^(\d{2})\s+(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(\d{4})\b",
    re.IGNORECASE,
)
NUBANK_RUIDO_TERMOS = (
    "cnpj", "valores em r$", "movimentacoes", "extrato gerado",
    "tem alguma duvida", "ouvidoria", "nao nos responsabilizamos",
    "asseguramos a autenticidade", "nu financeira", "nu pagamentos s.a. -",
)
PERIOD_PATTERN_EXTENSO = re.compile(
    r"(\d{2}\s+DE\s+[A-ZÇ]+\s+DE\s+\d{4}\s+a\s+\d{2}\s+DE\s+[A-ZÇ]+\s+DE\s+\d{4})",
    re.IGNORECASE,
)


def detect(full_text: str) -> bool:
    normalized = fold(full_text)
    return "nubank" in normalized or ("nu pagamentos" in normalized and "saldo do dia" in normalized)


def _strip_page_header(page_text: str) -> str:
    """Remove o cabeçalho (titular/CNPJ/período) repetido no topo de cada página."""
    lines = page_text.splitlines()
    for index, line in enumerate(lines):
        if "valores em r$" in fold(line):
            return "\n".join(lines[index + 1 :])
    return page_text


def _extrair_saldo_inicial(full_text: str) -> float | None:
    for raw_line in full_text.splitlines():
        if "saldo inicial" in fold(raw_line):
            valores = money_matches(raw_line)
            if valores:
                return float(valores[-1][0])
    return None


def _periodo_declarado(full_text: str) -> str | None:
    match = PERIOD_PATTERN_EXTENSO.search(full_text)
    return match.group(1) if match else None


def parse(pdf_path, pages: list[str], full_text: str) -> dict[str, object]:
    lines: list[str] = []
    for page in pages:
        lines.extend(_strip_page_header(page).splitlines())

    current_date: str | None = None
    state: str | None = None  # "entradas" | "saidas" | None
    transacoes: list[dict[str, object]] = []
    pending: dict[str, object] | None = None
    ultimo_saldo_dia: float | None = None

    def finalize_pending() -> None:
        nonlocal pending
        if pending is None:
            return
        valor_bruto = pending["valor"]
        if valor_bruto is None or pending["data"] is None or pending["state"] not in ("entradas", "saidas"):
            pending = None
            return
        descricao = clean_line(" ".join(pending["lines"]))  # type: ignore[arg-type]
        valor = float(valor_bruto)  # type: ignore[arg-type]
        valor = -abs(valor) if pending["state"] == "saidas" else abs(valor)
        # O Nubank às vezes escreve só "Transferência Recebida Fulano", sem a
        # palavra "Pix" — mas nesse extrato toda movimentação por
        # transferência É um Pix, então classificamos por "recebid"/"enviad"
        # sozinhos, sem exigir que "pix" apareça também.
        normalizado = fold(descricao)
        if "recebid" in normalizado:
            tipo_forcado = "PIX_RECEBIDO"
        elif "enviad" in normalizado:
            tipo_forcado = "PIX_ENVIADO"
        else:
            tipo_forcado = "ENTRADA_OUTRA" if valor >= 0 else "SAIDA_OUTRA"
        transacoes.append(  # type: ignore[arg-type]
            build_transacao(pending["data"], descricao, valor, tipo_operacao_forcado=tipo_forcado)
        )
        pending = None

    for raw_line in lines:
        line = clean_line(raw_line)
        if not line:
            continue
        folded = fold(line)

        if any(term in folded for term in NUBANK_RUIDO_TERMOS):
            continue

        header_match = NUBANK_DIA_PATTERN.match(line)
        if header_match:
            finalize_pending()
            day, month_abbr, year = header_match.groups()
            current_date = f"{day}/{NUBANK_MESES[month_abbr.upper()]}/{year}"
            state = "entradas"
            continue

        if folded.startswith("total de saidas"):
            finalize_pending()
            state = "saidas"
            continue

        if folded.startswith("saldo do dia"):
            finalize_pending()
            valores = money_matches(line)
            if valores:
                ultimo_saldo_dia = float(valores[-1][0])
            state = None
            continue

        if folded.startswith("transferencia"):
            # O valor do lançamento vem no final desta mesma linha; o resto
            # (nome, CPF/CNPJ mascarado, banco) é a descrição.
            finalize_pending()
            values = money_matches(line)
            if values:
                amount, start, end, _raw = values[-1]
                descricao_linha = (line[:start] + line[end:]).strip().rstrip("-").strip()
                valor_linha: float | None = float(amount)
            else:
                descricao_linha = line
                valor_linha = None
            pending = {"data": current_date, "state": state, "valor": valor_linha, "lines": [descricao_linha]}
            continue

        if pending is not None:
            pending["lines"].append(line)  # type: ignore[union-attr]

    finalize_pending()

    saldo_final = ultimo_saldo_dia
    saldo_inicial = _extrair_saldo_inicial(full_text)
    if saldo_inicial is None and saldo_final is not None:
        # Não achamos o "Saldo inicial" do quadro-resumo de forma
        # independente; deduzi-lo pela identidade (saldo final - soma)
        # tornaria a reconciliação circular, então a deixamos como
        # não verificada em vez de fabricar uma confirmação falsa.
        soma = round(sum(float(item["valorLiquido"]) for item in transacoes), 2)
        saldo_inicial = round(saldo_final - soma, 2)
        return montar_resultado(
            banco="Nubank",
            transacoes=transacoes,
            periodo=_periodo_declarado(full_text),
            saldo_inicial=saldo_inicial,
            saldo_final=saldo_final,
            reconciliacao_ok=None,
        )

    return montar_resultado(
        banco="Nubank",
        transacoes=transacoes,
        periodo=_periodo_declarado(full_text),
        saldo_inicial=saldo_inicial,
        saldo_final=saldo_final,
    )
