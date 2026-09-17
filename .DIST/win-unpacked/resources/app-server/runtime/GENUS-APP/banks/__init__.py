"""Parsers de extrato, um módulo por banco.

Cada módulo expõe duas funções:

``detect(full_text: str) -> bool``
    Diz se o texto extraído do PDF pertence a este banco. Usa sempre um
    trecho de texto que só aparece no cabeçalho/rodapé do PRÓPRIO extrato
    (nunca o nome de um banco que possa aparecer apenas como contraparte de
    um Pix, já que isso apareceria em extratos de outros bancos também).

``parse(pdf_path, pages, full_text) -> dict``
    Recebe o caminho do PDF, a lista de páginas de texto (uma string por
    página, na ordem do documento) e o texto completo já concatenado, e
    devolve o dicionário no formato exigido por ``genus-extractor.ts``.
"""
