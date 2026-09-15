"""Parser do extrato do Bradesco Net Empresa.

Layout real (confirmado com extrato de verdade): a data aparece só na
PRIMEIRA linha de cada dia. Cada lançamento é ou uma linha só ("GASTOS
CARTAO DE CREDITO 3990131 -2.872,37 -1.210,42", com tipo+documento+valor+
saldo juntos) ou duas peças separadas por outras linhas no meio — uma linha
só com o "tipo" (ex.: "PIX RECEBIDO"), depois a linha com documento+valor+
saldo, e por fim uma linha de detalhe (ex.: "REM: Fulano 01/05") que
pertence a ESSE lançamento, não ao próximo.

Como saber se uma linha de detalhe vem depois ou não? Quando o texto antes
do valor numa linha-valor está vazio (era só o número do documento, sem
nome de tipo), é porque o "tipo" já veio numa linha separada antes — nesse
caso hácom certeza uma linha de detalhe depois. Quando o texto antes do
valor já traz um tipo por extenso (lançamento de linha única), não há
detalhe depois; a próxima linha de texto já é o tipo do lançamento
seguinte.

O período principal termina antes da seção "Últimos Lançamentos" (uma
prévia de lançamentos futuros, fora do período pedido) — paramos de ler ao
encontrar a linha "Total" que fecha a tabela principal.
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
    strip_trailing_reference,
    texto_antes_do_valor,
)

_DATA_INICIO = re.compile(r"^(\d{2}/\d{2}/\d{4})\s*(.*)$")
_RUIDO_TERMOS = ("folha ", "nome do usuario", "data da operacao", "aviso:", "extrato de:")


def detect(full_text: str) -> bool:
    # "Bradesco" no logotipo costuma vir como imagem (não é texto
    # selecionável), então a marca segura é o cabeçalho da própria tabela de
    # lançamentos — não depende do logo ter sido extraído como texto.
    normalized = fold(full_text)
    return all(termo in normalized for termo in ("dcto.", "credito (r$)", "debito (r$)", "saldo (r$)"))


def _sem_numero_de_documento(texto: str) -> str:
    texto = texto.strip()
    if texto.isdigit():
        return ""
    return strip_trailing_reference(texto)


def parse(pdf_path, pages: list[str], full_text: str) -> dict[str, object]:
    lines: list[str] = []
    for page in pages:
        lines.extend(page.splitlines())

    transacoes: list[dict[str, object]] = []
    buffer: list[str] = []
    current_date: str | None = None
    aguardando_detalhe = False
    saldo_inicial: float | None = None
    saldo_final: float | None = None

    for raw_line in lines:
        line = clean_line(raw_line)
        if not line:
            continue

        match = _DATA_INICIO.match(line)
        if match:
            current_date = match.group(1)
            conteudo = match.group(2).strip()
            if fold(conteudo).startswith("saldo anterior"):
                valores_saldo = money_matches(conteudo)
                if valores_saldo:
                    saldo_inicial = float(valores_saldo[-1][0])
                buffer = []
                aguardando_detalhe = False
                continue
        elif current_date is not None:
            conteudo = line
        else:
            # Texto de cabeçalho antes do "SALDO ANTERIOR" (agência/conta,
            # cabeçalho da tabela) — nunca faz parte de um lançamento.
            continue

        if not conteudo:
            continue

        if fold(conteudo).startswith(_RUIDO_TERMOS):
            continue

        primeira_palavra = conteudo.split()[0].lower() if conteudo.split() else ""
        if primeira_palavra == "total":
            valores_total = money_matches(conteudo)
            if valores_total:
                saldo_final = float(valores_total[-1][0])
            break

        valores = money_matches(conteudo)
        if len(valores) >= 2:
            valor_match, saldo_match = valores[-2], valores[-1]
            texto_extra = _sem_numero_de_documento(texto_antes_do_valor(conteudo, valor_match[1]))
            descricao = clean_line(" ".join(buffer + ([texto_extra] if texto_extra else [])))
            transacoes.append(build_transacao(current_date, descricao, float(valor_match[0])))
            saldo_final = float(saldo_match[0])
            buffer = []
            # Só esperamos uma linha de detalhe depois quando o "tipo" veio
            # de uma linha separada antes (texto_extra vazio); um
            # lançamento de linha única já trouxe o tipo embutido e não tem
            # detalhe — a próxima linha de texto já é o tipo do próximo.
            aguardando_detalhe = not texto_extra
        elif aguardando_detalhe and transacoes:
            ultima = transacoes[-1]
            ultima["nomeContraparte"] = clean_line(f"{ultima['nomeContraparte']} {conteudo}")[:500]
            aguardando_detalhe = False
        else:
            buffer.append(conteudo)
            aguardando_detalhe = False

    if not transacoes:
        raise ValueError("Não foi possível identificar transações neste PDF.")

    return montar_resultado(
        banco="Bradesco",
        transacoes=transacoes,
        periodo=guess_periodo(full_text) or _periodo_do_titulo(full_text),
        saldo_inicial=saldo_inicial,
        saldo_final=saldo_final,
    )


def _periodo_do_titulo(full_text: str) -> str | None:
    match = re.search(
        r"entre\s+(\d{2}/\d{2}/\d{4})\s+e\s+(\d{2}/\d{2}/\d{4})",
        full_text,
        re.IGNORECASE,
    )
    if not match:
        return None
    return f"{match.group(1)} a {match.group(2)}"
