"""Parser do extrato PJ do Itaú.

Cada lançamento começa numa linha própria com a data (`DD/MM/AAAA`). O maior
cuidado aqui é que o código de referência do Pix embute um trecho parecido
com data (ex.: "PIX RECEBIDO MIRIA B09/07 ..."), então a linha não pode ser
descartada só por conter mais de uma data — o que importa é que ela COMECE
com uma data. Linhas de fotografia de saldo ("SALDO TOTAL DISPONÍVEL DIA",
"SALDO ANTERIOR") batem no mesmo padrão de "começa com data" mas não são
lançamentos de verdade, e por isso são filtradas à parte.

O saldo final não vem rotulado como "saldo final" em lugar nenhum do
documento — o único lugar onde ele aparece é no quadro-resumo do topo
("Saldo total | Limite da conta | Utilizado | Disponível", com os valores
numa linha à parte). O extrator genérico (`extract_bank_statements.py`)
sabe procurar um rótulo seguido do valor na linha SEGUINTE, mas esse
quadro-resumo do Itaú tem uma linha em branco entre o rótulo e os valores
(sobra do jeito como o pdfplumber lê células de tabela bem espaçadas
verticalmente), então a busca genérica não encontra nada — por isso
extraímos esse valor aqui, pulando quantas linhas em branco houver.
"""

from __future__ import annotations

import re

from .common import build_transacao, fold, guess_default_year, guess_periodo, money_matches, montar_resultado, to_br_date

_SALDO_TOTAL_COM_LINHA_EM_BRANCO = re.compile(
    r"saldo\s+total[^\n]*\n(?:[ \t]*\n)*([^\n]*)",
    re.IGNORECASE,
)


def _saldo_final_do_resumo(full_text: str) -> float | None:
    match = _SALDO_TOTAL_COM_LINHA_EM_BRANCO.search(full_text)
    if not match:
        return None
    valores = money_matches(match.group(1))
    return float(valores[0][0]) if valores else None


def detect(full_text: str) -> bool:
    return "lancamentos do periodo" in fold(full_text)


def parse(pdf_path, pages: list[str], full_text: str) -> dict[str, object]:
    from extract_bank_statements import DATE_PATTERN, extract  # type: ignore

    default_year = guess_default_year(full_text)
    parsed = extract(pdf_path, default_year)

    def is_saldo_snapshot(transacao) -> bool:
        # Linhas como "08/07/2026 SALDO TOTAL DISPONÍVEL DIA -51,87" ou
        # "03/07/2026 SALDO ANTERIOR -657,80" são fotografias de saldo, não
        # lançamentos — mas começam com data como qualquer transação real.
        primeira_linha = transacao.texto_original.splitlines()[0]
        sem_data = fold(DATE_PATTERN.sub("", primeira_linha, count=1)).strip()
        return sem_data.startswith(("saldo total", "saldo anterior", "saldo do dia"))

    validas = [
        transacao
        for transacao in parsed.transacoes
        if transacao.data is not None and transacao.valor is not None and not is_saldo_snapshot(transacao)
    ]
    if not validas:
        raise ValueError("Não foi possível identificar transações neste PDF.")

    transacoes: list[dict[str, object]] = []
    for transacao in validas:
        valor = float(transacao.valor)
        descricao = transacao.descricao or ""
        transacoes.append(build_transacao(to_br_date(transacao.data), descricao, valor))

    saldo_inicial = parsed.cabecalho.get("saldo_inicial")
    saldo_final = parsed.cabecalho.get("saldo_final")
    saldo_inicial_float = float(saldo_inicial) if saldo_inicial is not None else None
    saldo_final_float = float(saldo_final) if saldo_final is not None else _saldo_final_do_resumo(full_text)

    banco = parsed.cabecalho.get("instituicao") or "Itau"

    return montar_resultado(
        banco=banco,
        transacoes=transacoes,
        periodo=guess_periodo(full_text),
        saldo_inicial=saldo_inicial_float,
        saldo_final=saldo_final_float,
    )
