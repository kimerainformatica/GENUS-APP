"""Funções e constantes reaproveitadas por vários parsers de banco."""

from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
SCRIPTS_DIR = PROJECT_ROOT / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from extract_bank_statements import (  # type: ignore  # noqa: E402
    clean_line,
    money_matches,
    parse_money,
)

__all__ = [
    "clean_line",
    "money_matches",
    "parse_money",
    "fold",
    "is_tarifa",
    "tipo_operacao",
    "strip_trailing_reference",
    "build_transacao",
    "montar_resultado",
    "guess_periodo",
    "guess_default_year",
    "to_br_date",
]

TARIFA_TERMS = ("tarifa", "encargo", "iof", "juros", "manut.c/c")

YEAR_PATTERN = re.compile(r"\b20\d{2}\b")

PERIOD_PATTERN_SLASH = re.compile(
    r"per[ií]odo[^\n]{0,20}?(\d{2}/\d{2}/\d{4}\s*(?:a|al|at[eé])\s*\d{2}/\d{2}/\d{4})",
    re.IGNORECASE,
)
PERIOD_PATTERN_DASH = re.compile(
    r"per[ií]odo[^\n]{0,20}?(\d{2}-\d{2}-\d{4}\s*(?:a|al|at[eé])\s*\d{2}-\d{2}-\d{4})",
    re.IGNORECASE,
)
PERIOD_PATTERN_EXTENSO = re.compile(
    r"(\d{2}\s+DE\s+[A-ZÇ]+\s+DE\s+\d{4}\s+a\s+\d{2}\s+DE\s+[A-ZÇ]+\s+DE\s+\d{4})",
    re.IGNORECASE,
)


def fold(value: str) -> str:
    """Remove acentos, normaliza para minúsculas e colapsa espaços/quebras de
    linha num espaço só — usado apenas para COMPARAR texto (ex.: "frase X
    está contida no PDF?"), nunca para produzir texto que vá para o
    resultado final. O colapso de quebras de linha importa porque um rótulo
    como "NU PAGAMENTOS" às vezes quebra em duas linhas no meio do PDF
    ("NU\\nPAGAMENTOS"), e sem isso a busca por substring falharia mesmo em
    um extrato de verdade daquele banco.
    """
    sem_acento = "".join(
        character
        for character in unicodedata.normalize("NFD", value).lower()
        if unicodedata.category(character) != "Mn"
    )
    return re.sub(r"\s+", " ", sem_acento)


def is_tarifa(descricao: str) -> bool:
    normalized = fold(descricao)
    return any(term in normalized for term in TARIFA_TERMS)


def tipo_operacao(descricao: str, valor: float) -> str:
    normalized = fold(descricao)
    # A ordem das palavras varia por banco ("Pix Recebido X" no Bradesco,
    # "Transferência recebida pelo Pix X" no Nubank), então não exigimos uma
    # ordem fixa entre "pix" e "recebido/enviado".
    if "pix" in normalized and "recebid" in normalized:
        return "PIX_RECEBIDO"
    if "pix" in normalized and "enviad" in normalized:
        return "PIX_ENVIADO"
    return "ENTRADA_OUTRA" if valor >= 0 else "SAIDA_OUTRA"


def strip_trailing_reference(text: str) -> str:
    """Remove um número de documento/identificador isolado no fim do texto."""
    return re.sub(r"\s+\d{2,}\s*$", "", text).strip()


def texto_antes_do_valor(conteudo: str, inicio_do_valor: int) -> str:
    """Corta ``conteudo`` logo antes de um valor monetário já localizado.

    Alguns bancos (ex.: Mercado Pago) escrevem o "R$" ANTES do sinal de
    negativo ("R$ -239,60"), enquanto o padrão de dinheiro espera o sinal
    antes do "R$" ("-R$ 239,60"). Nesse caso o "R$" fica de fora do trecho
    casado pela regex e sobra colado no fim da descrição — por isso, além de
    cortar na posição do valor, removemos um "R$" residual que tenha ficado
    logo antes.
    """
    prefixo = conteudo[:inicio_do_valor]
    return re.sub(r"R\$\s*$", "", prefixo).strip()


def build_transacao(
    data: str,
    nome: str,
    valor: float,
    secao: str | None = None,
    tipo_operacao_forcado: str | None = None,
) -> dict[str, object]:
    """Monta uma transação no formato do contrato.

    ``tipo_operacao_forcado`` existe porque a palavra "Pix" nem sempre
    acompanha "recebido/enviado" no texto (o Nubank, por exemplo, também
    escreve só "Transferência Recebida Fulano", sem "pelo Pix") — quando o
    banco já sabe que aquilo é uma entrada/saída via Pix por outro sinal do
    layout, ele pode passar o tipo pronto em vez de depender só da palavra
    "pix" aparecer na descrição.
    """
    valor = round(float(valor), 2)
    nome_limpo = clean_line(nome).strip()
    if is_tarifa(nome_limpo):
        valor_bruto, tarifa_taxa = 0.0, abs(valor)
    else:
        valor_bruto, tarifa_taxa = valor, 0.0
    return {
        "data": data,
        "nomeContraparte": (nome_limpo or "Não informado")[:500],
        "tipoOperacao": tipo_operacao_forcado or tipo_operacao(nome_limpo, valor),
        "valorBruto": round(valor_bruto, 2),
        "tarifaTaxa": round(tarifa_taxa, 2),
        "valorLiquido": valor,
        "secao": secao,
    }


_AUTO = "auto"


def montar_resultado(
    banco: str,
    transacoes: list[dict[str, object]],
    periodo: str | None,
    saldo_inicial: float | None,
    saldo_final: float | None,
    reconciliacao_ok: object = _AUTO,
) -> dict[str, object]:
    """Monta o dicionário no formato de ``GenusExtractionResult``.

    ``somaCalculada`` é o saldo final que CALCULAMOS (saldo inicial + soma
    líquida dos lançamentos) — é isso que é comparado contra o
    ``saldoFinal`` declarado pelo próprio banco para preencher
    ``reconciliacaoOk``. Por padrão (``reconciliacao_ok="auto"``) essa
    comparação é feita automaticamente quando os dois saldos estão
    disponíveis; passe ``None`` explicitamente quando o saldo inicial foi
    apenas deduzido (não lido de verdade no PDF), para não fabricar uma
    reconciliação que na prática é circular.
    """
    if not transacoes:
        raise ValueError("Não foi possível identificar transações neste PDF.")
    soma_liquida = round(sum(float(item["valorLiquido"]) for item in transacoes), 2)
    soma_calculada = round((saldo_inicial or 0.0) + soma_liquida, 2)
    if reconciliacao_ok is _AUTO:
        reconciliacao_ok = (
            abs(round(soma_calculada - saldo_final, 2)) <= 0.01 if saldo_final is not None else None
        )
    return {
        "banco": banco,
        "periodoDeclarado": periodo,
        "saldoInicial": saldo_inicial,
        "saldoFinal": saldo_final,
        "somaCalculada": soma_calculada,
        "reconciliacaoOk": reconciliacao_ok,
        "transacoes": transacoes,
    }


def guess_periodo(full_text: str) -> str | None:
    for pattern in (PERIOD_PATTERN_SLASH, PERIOD_PATTERN_DASH, PERIOD_PATTERN_EXTENSO):
        match = pattern.search(full_text)
        if match:
            return match.group(1)
    return None


def guess_default_year(full_text: str) -> int:
    from datetime import date

    matches = YEAR_PATTERN.findall(full_text)
    if matches:
        return int(max(matches, key=matches.count))
    return date.today().year


def to_br_date(iso_date: str) -> str:
    ano, mes, dia = iso_date.split("-")
    return f"{dia}/{mes}/{ano}"
