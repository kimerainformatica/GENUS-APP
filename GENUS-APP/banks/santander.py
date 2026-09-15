"""Parser do extrato do Aplicativo Santander Empresas.

Cada lançamento começa numa linha com a data ("DD/MM/AAAA Pix Recebido
NOME"); quando o nome do contraparte é longo ele quebra para a(s) linha(s)
seguinte(s), e o valor + saldo após a operação vêm sempre no final da ÚLTIMA
linha do lançamento (às vezes com um número de documento logo antes). Não há
como saber de antemão quantas linhas um lançamento vai ocupar, então
acumulamos linhas num buffer até aparecer uma linha com pelo menos dois
valores monetários (valor e saldo) — aí fechamos o lançamento.

O extrato lista do lançamento mais recente para o mais antigo (ordem
decrescente de data), e cada linha mostra o saldo JÁ REFLETINDO aquele
lançamento. Não existe um "saldo anterior" declarado no cabeçalho, então o
saldo inicial do período é deduzido a partir do saldo após o lançamento mais
antigo, subtraindo o valor desse mesmo lançamento.

O saldo final vem do saldo já mostrado após o lançamento mais recente (não
do "Saldo disponível para uso" do cabeçalho): esse valor do cabeçalho é o
saldo somado a um saldo de investimentos que rende por fora, sem aparecer
como lançamento nenhum — então ele pode ficar alguns centavos à frente do
saldo da conta corrente sozinha, o que faria a conferência apontar
divergência mesmo com todos os lançamentos lidos certinhos.
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

_DATA_INICIO = re.compile(r"^(\d{2}/\d{2}/\d{4})\s*(.*)$")
_RUIDO_TERMOS = ("agencia:", "conta:", "data/hora:")


def detect(full_text: str) -> bool:
    return "aplicativo santander empresas" in fold(full_text)


def parse(pdf_path, pages: list[str], full_text: str) -> dict[str, object]:
    lines: list[str] = []
    for page in pages:
        lines.extend(page.splitlines())

    lancamentos: list[tuple[dict[str, object], float]] = []
    buffer: list[str] = []
    current_date: str | None = None

    for raw_line in lines:
        line = clean_line(raw_line)
        if not line:
            continue
        folded = fold(line)
        if folded.startswith("data historico") or any(term in folded for term in _RUIDO_TERMOS):
            continue

        match = _DATA_INICIO.match(line)
        if match:
            current_date = match.group(1)
            conteudo = match.group(2).strip()
        elif current_date is not None:
            conteudo = line
        else:
            # Texto de cabeçalho antes do primeiro lançamento (titular,
            # período, saldo disponível) — não faz parte de nenhuma
            # transação, então nunca deve entrar no buffer.
            continue

        if not conteudo:
            continue

        valores = money_matches(conteudo)
        if len(valores) >= 2 and current_date is not None:
            valor_match, saldo_match = valores[-2], valores[-1]
            descricao_bruta = texto_antes_do_valor(conteudo, valor_match[1])
            descricao = clean_line(" ".join(buffer + [descricao_bruta]))
            descricao = re.sub(r"\s+\d{4,}\s*$", "", descricao).strip()
            transacao = build_transacao(current_date, descricao, float(valor_match[0]))
            lancamentos.append((transacao, float(saldo_match[0])))
            buffer = []
        else:
            buffer.append(conteudo)

    if not lancamentos:
        raise ValueError("Não foi possível identificar transações neste PDF.")

    saldo_final = lancamentos[0][1]

    transacao_mais_antiga, saldo_apos_mais_antiga = lancamentos[-1]
    saldo_inicial = round(saldo_apos_mais_antiga - float(transacao_mais_antiga["valorLiquido"]), 2)

    transacoes = [item[0] for item in lancamentos]

    return montar_resultado(
        banco="Santander",
        transacoes=transacoes,
        periodo=guess_periodo(full_text),
        saldo_inicial=saldo_inicial,
        saldo_final=saldo_final,
    )
