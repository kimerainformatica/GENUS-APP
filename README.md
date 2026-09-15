# Genus Contabilidade

Portal interno para cadastro de clientes, importação de extratos bancários e análise de gastos. A aplicação usa Next.js 16, Prisma 7, SQLite e o extrator Python em `GENUS-APP`.

## Requisitos

- Node.js 20 ou superior
- Python 3.11 ou superior
- Dependências de `GENUS-APP/requirements.txt`
- Para PDFs escaneados: Tesseract OCR com idioma português e Poppler no `PATH`

## Instalação

```bash
npm install
python -m pip install -r GENUS-APP/requirements.txt
npm run db:migrate
npm run dev
```

Copie `.env.example` para `.env` antes de iniciar. O banco padrão é o arquivo local `dev.db`.

Na primeira visita a `/login`, o sistema solicita a criação do administrador. Depois desse cadastro, a configuração inicial é desativada e somente credenciais válidas abrem o portal.

## Comandos

```bash
npm run dev          # desenvolvimento
npm run build        # build de produção
npm run lint         # análise estática
npm run db:generate  # regenera o Prisma Client
npm run db:migrate   # cria/aplica migrações em desenvolvimento
npm run db:status    # confere migrações aplicadas
```

O `postinstall` regenera o Prisma Client automaticamente. Isso é necessário sempre que o schema muda e evita erros como `Unknown argument nomeContraparte`.

## Importação de extratos

O upload aceita PDFs de até 10 MB dos bancos Santander, Bradesco, Itaú, Inter, Nubank, Mercado Pago e PicPay. Cada arquivo é validado, identificado por SHA-256 para impedir duplicidade por cliente e processado em um diretório temporário.

O dashboard usa diretamente as transações extraídas para apresentar:

- entradas, gastos e resultado do período;
- média e maior gasto;
- tarifas identificadas;
- evolução diária ou mensal;
- categorias, bancos e maiores contrapartes;
- saldo mais recente e situação da reconciliação.

## Segurança e dados

- Todas as páginas financeiras e Server Actions verificam uma sessão opaca armazenada no banco.
- Senhas são armazenadas com bcrypt e tokens de sessão somente como SHA-256.
- PDFs e CSVs em `GENUS-APP/extratos` e `GENUS-APP/resultados` são ignorados pelo Git por conterem dados financeiros.
- SQLite é apropriado para uso local ou servidor único. Para múltiplas instâncias, migre para um banco persistente como PostgreSQL e execute o extrator em um worker dedicado.
