"""Parser do extrato bancário do PicPay Empresas.

Formato real (confirmado com extrato de verdade, não só o texto colado no
chat): cada lançamento vem inteiro numa linha só — "DD/MM/AAAA
<Movimentação> Entrada|Saída R$ X,XX" — e o valor já vem com o sinal certo
(negativo para Saída, ex.: "-R$ 12.653,47"), então nem precisamos olhar a
palavra "Entrada"/"Saída" para decidir o sinal, só para removê-la do texto
da descrição. A linha seguinte traz só o nome da contraparte (ou a palavra
literal "Saldo" quando não há contraparte nomeada, como em pagamentos de
boleto).

Uma linha "DD/MM/AAAA" isolada seguida só do saldo acumulado ("R$ X,XX",
sem nenhum texto de movimentação no meio) é apenas um checkpoint do saldo
no início daquele dia, não é lançamento.

Saldo inicial e final vêm declarados explicitamente no cabeçalho do próprio
documento ("Saldo inicial: 01/07/2026 R$ 560.283,77" / "Saldo final:
31/07/2026 R$ 557.708,54"), então não precisamos deduzi-los.
"""

from __future__ import annotations

import re

from .common import build_transacao, clean_line, fold, guess_periodo, money_matches, montar_resultado

_DATA_E_RESTO = re.compile(r"^(\d{2}/\d{2}/\d{4})\s*(.*)$")
_CHECKPOINT_DE_SALDO = re.compile(r"^\d{2}/\d{2}/\d{4}\s+R\$\s*[\d.,]+\s*$")
_TIPO_FINAL = re.compile(r"\s*(Entrada|Sa[íi]da)\s*$", re.IGNORECASE)
_PAGINA = re.compile(r"^\d+\s+de\s+\d+$", re.IGNORECASE)
_RUIDO_RODAPE = ("picpay servicos", "ouvidoria")


def detect(full_text: str) -> bool:
    return "picpay servicos" in fold(full_text)


def parse(pdf_path, pages: list[str], full_text: str) -> dict[str, object]:
    lines: list[str] = []
    for page in pages:
        lines.extend(page.splitlines())

    transacoes: list[dict[str, object]] = []
    pending: dict[str, object] | None = None

    def finalize(nome: str | None = None) -> None:
        nonlocal pending
        if pending is None:
            return
        tipo_texto = pending["tipo"]
        descricao = f"{tipo_texto} {nome}".strip() if nome and fold(nome) != "saldo" else tipo_texto
        transacoes.append(build_transacao(pending["data"], descricao, pending["valor"]))  # type: ignore[arg-type]
        pending = None

    for raw_line in lines:
        line = clean_line(raw_line)
        if not line:
            continue

        if _CHECKPOINT_DE_SALDO.match(line):
            finalize()
            continue

        match = _DATA_E_RESTO.match(line)
        if match:
            finalize()
            data, resto = match.groups()
            resto = resto.strip()
            valores = money_matches(resto)
            if not resto or not valores:
                continue
            valor_match = valores[-1]
            tipo_texto = _TIPO_FINAL.sub("", resto[: valor_match[1]]).strip()
            if not tipo_texto:
                continue
            pending = {"data": data, "tipo": tipo_texto, "valor": float(valor_match[0])}
            continue

        if pending is not None:
            folded = fold(line)
            if _PAGINA.match(line) or any(term in folded for term in _RUIDO_RODAPE):
                finalize()
                continue
            finalize(nome=line)

    finalize()

    if not transacoes:
        raise ValueError("Não foi possível identificar transações neste PDF.")

    saldo_inicial = _valor_apos_rotulo(full_text, r"saldo inicial:")
    saldo_final = _valor_apos_rotulo(full_text, r"saldo final:")

    return montar_resultado(
        banco="PicPay",
        transacoes=transacoes,
        periodo=guess_periodo(full_text),
        saldo_inicial=saldo_inicial,
        saldo_final=saldo_final,
    )


def _valor_apos_rotulo(full_text: str, rotulo: str) -> float | None:
    match = re.search(rf"{rotulo}\s*\d{{2}}/\d{{2}}/\d{{4}}\s*R?\$?\s*(-?[\d.,]+)", full_text, re.IGNORECASE)
    if not match:
        return None
    valores = money_matches(match.group(0))
    return float(valores[-1][0]) if valores else None
