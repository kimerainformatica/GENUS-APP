#!/usr/bin/env python3
"""Ponte entre o Node (genus-extractor.ts) e os parsers de extrato por banco.

Uso: python cli.py <caminho-do-pdf>

Lê o PDF, descobre de qual banco é o extrato (cada banco tem seu próprio
módulo em GENUS-APP/banks/, com um jeito de ler bem diferente um do outro) e
imprime em stdout um único JSON no formato que genus-extractor.ts espera
(banco, periodoDeclarado, saldoInicial, saldoFinal, somaCalculada,
reconciliacaoOk, transacoes[]). Em caso de falha, imprime {"error": "..."}
em vez de lançar uma exceção, para que o Node sempre receba um JSON válido.
"""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

GENUS_APP_DIR = Path(__file__).resolve().parent
SCRIPTS_DIR = GENUS_APP_DIR.parent / "scripts"
for directory in (SCRIPTS_DIR, GENUS_APP_DIR):
    if str(directory) not in sys.path:
        sys.path.insert(0, str(directory))

from banks import bradesco, inter, itau, mercadopago, nubank, picpay, santander  # type: ignore  # noqa: E402

# A ordem importa: extratos de um banco costumam citar OUTROS bancos como
# contraparte de Pix (ex.: o extrato do Nubank menciona "BCO BRADESCO",
# "MERCADO PAGO IP LTDA.", "ITAÚ UNIBANCO" dezenas de vezes). Por isso cada
# detect() abaixo procura uma frase que só existe no cabeçalho/rodapé do
# PRÓPRIO extrato daquele banco — nunca o nome do banco isolado — e ainda
# assim a ordem de checagem vai do mais específico para o mais genérico.
BANK_MODULES = [nubank, picpay, mercadopago, inter, bradesco, santander, itau]

BANCOS_SUPORTADOS = "Nubank, PicPay, Mercado Pago, Banco Inter, Bradesco, Santander e Itaú"

# Grava o texto bruto (como o pdfplumber realmente o vê) de cada PDF
# processado, para permitir diagnosticar bancos que não são detectados ou que
# retornam zero lançamentos sem precisar do arquivo binário original.
#
# Fica DESLIGADO por padrão: o texto de um extrato inclui nome de
# contrapartes, valores e documentos parciais, então só grava enquanto o
# arquivo marcador abaixo existir (criado só durante uma investigação
# pontual, nunca deixado em produção). Best effort: nunca deve derrubar a
# extração real por falha ao escrever o log.
DEBUG_DIR = GENUS_APP_DIR / "_debug_extracts"
DEBUG_MARCADOR = GENUS_APP_DIR / "_debug_extracao.on"


def _dump_debug(full_text: str, rotulo: str) -> None:
    if not DEBUG_MARCADOR.exists():
        return
    try:
        DEBUG_DIR.mkdir(exist_ok=True)
        nome = f"{time.strftime('%Y%m%d-%H%M%S')}_{rotulo}.txt"
        (DEBUG_DIR / nome).write_text(full_text, encoding="utf-8")
    except OSError:
        pass


def build_result(pdf_path: Path) -> dict[str, object]:
    from extract_bank_statements import extract_pdf_pages  # type: ignore

    pages = extract_pdf_pages(pdf_path)
    full_text = "\n".join(pages)

    matched = next((module for module in BANK_MODULES if module.detect(full_text)), None)
    _dump_debug(full_text, matched.__name__.rsplit(".", 1)[-1] if matched else "desconhecido")

    if matched is None:
        raise ValueError(f"Banco não reconhecido. Bancos suportados hoje: {BANCOS_SUPORTADOS}.")
    return matched.parse(pdf_path, pages, full_text)


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Caminho do PDF não informado."}))
        return 0

    pdf_path = Path(sys.argv[1])
    try:
        if not pdf_path.is_file():
            raise ValueError(f"Arquivo não encontrado: {pdf_path}")
        result = build_result(pdf_path)
        print(json.dumps(result, ensure_ascii=False))
    except SystemExit as error:
        print(json.dumps({"error": str(error.code or error)}, ensure_ascii=False))
    except Exception as error:  # noqa: BLE001 - sempre reportar como JSON para o chamador
        print(json.dumps({"error": str(error)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
