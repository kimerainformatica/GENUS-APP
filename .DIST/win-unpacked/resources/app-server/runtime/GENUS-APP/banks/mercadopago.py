"""Parser do extrato de conta do Mercado Pago.

Cada linha começa com a data no formato "DD-MM-AAAA" (com hífen, não
barra); descrições longas quebram para a linha seguinte, e o ID da operação
mais os dois valores (valor do lançamento e saldo após ele) sempre fecham a
última linha do lançamento. Diferente dos outros bancos, aqui o saldo
inicial e o saldo final do período vêm declarados explicitamente no próprio
texto ("Saldo inicial: R$ 55,12" / "Saldo final: R$ 0,00"), então não
precisamos deduzi-los.
"""

from __future__ import annotations

import re

from .common import (
    build_transacao,
    clean_line,
    fold,
    guess_periodo,
    money_matches,
    montar_resultado,
    texto_antes_do_valor,
)

_DATA_INICIO = re.compile(r"^(\d{2})-(\d{2})-(\d{4})\s*(.*)$")


def detect(full_text: str) -> bool:
    return "mercado pago instituicao de pagamento" in fold(full_text)


def parse(pdf_path, pages: list[str], full_text: str) -> dict[str, object]:
    lines: list[str] = []
    for page in pages:
        lines.extend(page.splitlines())

    transacoes: list[dict[str, object]] = []
    buffer: list[str] = []
    current_date: str | None = None

    for raw_line in lines:
        line = clean_line(raw_line)
        if not line:
            continue

        match = _DATA_INICIO.match(line)
        if match:
            dia, mes, ano, resto = match.groups()
            current_date = f"{dia}/{mes}/{ano}"
            conteudo = resto.strip()
        elif current_date is not None:
            conteudo = line
        else:
            # Texto de cabeçalho antes do primeiro lançamento.
            continue

        if not conteudo:
            continue

        valores = money_matches(conteudo)
        if len(valores) >= 2:
            valor_match, saldo_match = valores[-2], valores[-1]
            descricao_bruta = texto_antes_do_valor(conteudo, valor_match[1])
            descricao = clean_line(" ".join(buffer + [descricao_bruta]))
            descricao = re.sub(r"\s+\d{5,}\s*$", "", descricao).strip()
            transacoes.append(build_transacao(current_date, descricao, float(valor_match[0])))
            buffer = []
        else:
            buffer.append(conteudo)

    if not transacoes:
        raise ValueError("Não foi possível identificar transações neste PDF.")

    saldo_inicial = _valor_apos_rotulo(full_text, r"saldo inicial:")
    saldo_final = _valor_apos_rotulo(full_text, r"saldo final:")

    return montar_resultado(
        banco="Mercado Pago",
        transacoes=transacoes,
        periodo=guess_periodo(full_text),
        saldo_inicial=saldo_inicial,
        saldo_final=saldo_final,
    )


def _valor_apos_rotulo(full_text: str, rotulo: str) -> float | None:
    match = re.search(rf"{rotulo}\s*R\$\s*(-?[\d.,]+)", full_text, re.IGNORECASE)
    if not match:
        return None
    valores = money_matches(match.group(0))
    return float(valores[-1][0]) if valores else None
