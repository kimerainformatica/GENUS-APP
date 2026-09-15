"""Parser do extrato do Banco Inter.

Cada dia começa com um cabeçalho por extenso ("1 de Julho de 2026 Saldo do
dia: R$ 16.723,03"); os lançamentos daquele dia vêm logo abaixo, um por
linha, sempre completos numa linha só (ex.: 'Pix recebido: "Cp
:08561701-Cristian Alejandro Maestre" R$ 201,00 R$ 23.359,03'). O texto
entre aspas é a contraparte; os dois valores no final são o valor do
lançamento e o saldo acumulado logo após ele.

Não existe um saldo inicial declarado explicitamente no documento (o "Saldo
total" do topo é o saldo atual na data de emissão, que pode já incluir
lançamentos depois do fim do período pedido) — por isso o saldo inicial é
deduzido a partir do saldo final do período e da soma dos lançamentos, e a
reconciliação fica marcada como não verificada.
"""

from __future__ import annotations

import re

from .common import build_transacao, clean_line, fold, guess_periodo, money_matches, montar_resultado

_MESES = {
    "janeiro": "01", "fevereiro": "02", "marco": "03", "abril": "04", "maio": "05", "junho": "06",
    "julho": "07", "agosto": "08", "setembro": "09", "outubro": "10", "novembro": "11", "dezembro": "12",
}
_DIA_CABECALHO = re.compile(
    r"^(\d{1,2})\s+de\s+([A-Za-zçÇ]+)\s+de\s+(\d{4})\s+saldo do dia:",
    re.IGNORECASE,
)
_CONTRAPARTE_ENTRE_ASPAS = re.compile(r'"([^"]*)"')
_CP_PREFIXO = re.compile(r"^Cp\s*:\s*\d+\s*-\s*", re.IGNORECASE)


def detect(full_text: str) -> bool:
    normalized = fold(full_text)
    return "banco inter" in normalized and "saldo do dia:" in normalized


def parse(pdf_path, pages: list[str], full_text: str) -> dict[str, object]:
    lines: list[str] = []
    for page in pages:
        lines.extend(page.splitlines())

    transacoes: list[dict[str, object]] = []
    current_date: str | None = None

    for raw_line in lines:
        line = clean_line(raw_line)
        if not line:
            continue

        cabecalho = _DIA_CABECALHO.match(fold(line))
        if cabecalho:
            dia, mes_nome, ano = cabecalho.groups()
            mes = _MESES.get(mes_nome.lower())
            if mes:
                current_date = f"{int(dia):02d}/{mes}/{ano}"
            continue

        if current_date is None:
            continue

        valores = money_matches(line)
        if len(valores) < 2:
            continue

        valor_match, _saldo_match = valores[-2], valores[-1]
        descricao_bruta = line[: valor_match[1]].strip().rstrip(":").strip()
        contraparte_match = _CONTRAPARTE_ENTRE_ASPAS.search(descricao_bruta)
        if contraparte_match:
            nome = _CP_PREFIXO.sub("", contraparte_match.group(1)).strip()
            tipo_texto = descricao_bruta[: contraparte_match.start()].strip().rstrip(":")
            descricao = f"{tipo_texto} {nome}".strip() if tipo_texto else nome
        else:
            descricao = descricao_bruta

        transacoes.append(build_transacao(current_date, descricao, float(valor_match[0])))

    if not transacoes:
        raise ValueError("Não foi possível identificar transações neste PDF.")

    saldo_final = _saldo_da_ultima_linha(lines)
    soma = round(sum(float(item["valorLiquido"]) for item in transacoes), 2)
    saldo_inicial = round(saldo_final - soma, 2) if saldo_final is not None else None

    return montar_resultado(
        banco="Banco Inter",
        transacoes=transacoes,
        periodo=guess_periodo(full_text),
        saldo_inicial=saldo_inicial,
        saldo_final=saldo_final,
        reconciliacao_ok=None,
    )


def _saldo_da_ultima_linha(lines: list[str]) -> float | None:
    for line in reversed(lines):
        cleaned = clean_line(line)
        if not cleaned:
            continue
        valores = money_matches(cleaned)
        if len(valores) >= 2:
            return float(valores[-1][0])
    return None
