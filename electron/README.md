# Empacotamento do Genus Contabilidade como app desktop (.exe)

Este diretório contém o wrapper Electron que roda o app como um programa
desktop de verdade (janela própria, sem precisar abrir navegador), com um
`.exe` gerado em `.DIST/`.

## Como gerar o .exe

```
npm run electron:dist
```

Isso roda em sequência:
1. `next build --webpack` — build de produção do Next.js.
2. `scripts/electron/prepare-resources.mjs` — monta tudo que o app precisa
   em runtime (ver detalhes abaixo).
3. `electron-builder` — gera o **instalador** Windows em
   **`.DIST/Genus Contabilidade Setup <versão>.exe`** (e a versão
   "descompactada" equivalente em `.DIST/win-unpacked/`). É esse instalador
   que vai para a empresa.

## Instalar, atualizar e desinstalar (na empresa)

- **Instalar:** rodar `Genus Contabilidade Setup <versão>.exe`. O Windows pede
  permissão de administrador uma vez; o programa vai para
  `C:\Program Files\Genus Contabilidade\`, para todos os usuários do PC, com
  atalhos na Área de Trabalho e no menu Iniciar.
- **Atualizar:** rodar o instalador da versão nova por cima — não precisa
  desinstalar antes. O instalador troca só os arquivos do programa; os dados
  em `%APPDATA%\genus_contabilidade\` não são tocados, e o banco é atualizado
  na primeira abertura (ver "Atualizações e banco de dados").
- **Desinstalar:** pelo "Adicionar ou remover programas" do Windows. Remove o
  programa e **pergunta** se deve apagar também os dados (padrão: NÃO). Para
  apagar, o usuário precisa confirmar duas vezes. Durante uma atualização ou
  numa desinstalação silenciosa (`/S`), os dados nunca são apagados. A
  lógica fica em `electron/installer.nsh`.
- **Quem usava o `.exe` portátil antigo (versão 0.1.0 portátil):** basta rodar
  o instalador e depois apagar o `.exe` portátil. Os dados são os mesmos
  (mesma pasta em `%APPDATA%`) e aparecem no programa instalado.

Rodar só o passo de preparação (útil para testar com `npm run electron:dev`
sem gerar o `.exe` inteiro): `npm run electron:prepare`.

## Testar sem empacotar

```
npm run electron:prepare   # uma vez, ou de novo após mudar código
npm run electron:dev       # abre a janela usando os recursos já preparados
```

## Como funciona por baixo

- **Não existe um Node.js separado embutido.** O processo principal do
  Electron (`electron/main.cjs`) sobe o servidor Next.js chamando o próprio
  binário do Electron com a variável `ELECTRON_RUN_AS_NODE=1`, que faz ele se
  comportar como um Node.js comum. Isso evita duplicar ~80MB de um runtime
  Node à parte.
- **Banco de dados**: o `.exe` nunca grava dentro da própria pasta de
  instalação (pode ser só leitura). No primeiro uso, ele copia
  `template.db` (um SQLite com o schema do Prisma já aplicado, zero dados)
  para `%APPDATA%\genus_contabilidade\genus.db`, e é isso que o app usa dali
  em diante. Apagar esse arquivo "reseta" o app para o estado de fábrica.
- **Python**: ao abrir, o app tenta detectar `python`/`py`/`python3` no
  PATH. Se não achar, mostra um aviso oferecendo rodar o instalador oficial
  do python.org que vai empacotado dentro do `.exe`
  (`electron/resources/python-installer.exe`, baixado direto de
  `python.org` por `scripts/electron/download-python-installer.mjs` — nunca
  é uma cópia fabricada). O resto do app funciona sem Python; só a
  importação de extratos em PDF depende dele.

## ⚠️ Pasta dos dados — NUNCA mudar

Os dados de cada empresa ficam em **`%APPDATA%\genus_contabilidade\`**
(`genus.db` + `backups\`), fora do `.exe`. Esse caminho é **fixado no código**
(`USER_DATA_DIR_NAME` em `electron/main.cjs`), independente do `"name"` ou do
`productName` do `package.json` — renomear o pacote/produto é seguro.

**Não altere `USER_DATA_DIR_NAME`.** Se ele mudar, a versão nova abre uma
pasta vazia e a empresa vê o app "zerado": os dados continuam no disco, mas o
app deixa de enxergá-los. Se um dia for realmente preciso trocar a pasta, a
versão nova tem que primeiro **mover** a pasta antiga para a nova antes de
abrir o banco — nunca só trocar o nome.

## Atualizações e banco de dados

Uma versão nova é só um instalador novo, rodado por cima do anterior. O banco (`%APPDATA%\genus_contabilidade\genus.db`) fica fora do
`.exe` e é **atualizado sozinho** na primeira abertura da versão nova
(`electron/db-migrator.cjs`):

1. confere a integridade do arquivo — se estiver corrompido, o app não abre
   e indica a pasta de backups (nunca migra por cima de um banco estragado);
2. se houver migration nova, faz um **backup completo** antes em
   `%APPDATA%\genus_contabilidade\backups\` (guarda os 10 últimos);
3. aplica cada migration pendente numa transação própria, conferindo as
   referências entre tabelas antes de confirmar — se algo falhar, aquela
   etapa é desfeita inteira e o app mostra o erro com o botão
   "Abrir pasta de backups";
4. se o banco já foi atualizado por uma versão **mais nova** e alguém abrir
   um `.exe` antigo, o app se recusa a abrir em vez de gravar dados
   incompatíveis.

O controle usa a mesma tabela (`_prisma_migrations`) e o mesmo checksum do
Prisma, então o banco continua compatível com `npx prisma migrate status`.

### Checklist para lançar uma atualização

1. Mudou o schema? Rode `npm run db:migrate` (gera a migration nova em
   `prisma/migrations/`). **Nunca edite uma migration já commitada** — ela
   pode já ter rodado no banco do cliente; toda mudança vira migration nova.
2. Prefira mudanças que só **adicionam**: coluna nova opcional (`Int?`,
   `String?`) ou com `@default(...)`, tabela nova, índice novo. Coluna
   obrigatória sem default quebra em tabelas que já têm linhas.
3. Remover/renomear coluna ou tabela exige cuidado: o Prisma no SQLite
   "recria" a tabela copiando os dados, mas descarta em silêncio o que saiu do
   schema. Nesses casos, confira o `migration.sql` gerado (e copie os dados
   para a coluna nova antes de apagar a velha, se for o caso) e só então
   adicione a linha `-- genus:revisado` nele.
4. Aumente `"version"` no `package.json` (aparece no nome do `.exe` e dos
   backups). Não mexa em `USER_DATA_DIR_NAME` (ver "Pasta dos dados" acima).
5. `npm run electron:dist`. O passo de preparação roda `npm run db:check`
   antes de tudo e **barra o build** se alguma migration nova apagar,
   renomear ou reescrever dados sem a revisão acima, se tiver coluna
   obrigatória sem default, ou se uma migration já commitada foi editada.

Para testar uma atualização antes de entregar, rode o app apontando para uma
cópia do banco real (nunca para o original):
`npx electron . --user-data-dir="C:\caminho\de\teste"` com o `genus.db`
copiado para essa pasta. No terminal do VS Code, rode antes
`Remove-Item Env:ELECTRON_RUN_AS_NODE` — o VS Code define essa variável e ela
faz o Electron abrir como Node puro.

## Duas armadilhas reais que já foram resolvidas aqui (não mexer sem saber por quê)

1. **`next build` sem `--webpack` quebra o .exe silenciosamente em outra
   máquina.** O build padrão usa Turbopack, que (nesta versão do Next)
   embute o caminho absoluto de disco da máquina que fez o build dentro de
   `server.js`, usado para resolver módulos nativos externos
   (`better-sqlite3`, etc). Funciona na hora (porque a pasta ainda está no
   mesmo lugar), mas quebra assim que `.next/standalone` é copiado para
   dentro do `.exe` em outra máquina/pasta (`Cannot find module`). O build
   com webpack gera `require("better-sqlite3")` puro e portátil.
2. **O `node_modules` do `.next/standalone` precisa ficar num subnível
   extra de pasta.** O electron-builder tem uma regra fixa
   (`app-builder-lib/util/filter.js`) que sempre descarta uma pasta chamada
   exatamente `node_modules` quando ela é filha direta da origem de um
   `extraResources`. Por isso `prepare-resources.mjs` copia tudo para
   `electron/resources/app-server/runtime/` em vez de apontar direto pra
   `.next/standalone` — com esse nível a mais, o `node_modules` deixa de
   ser filho direto e sobrevive ao empacotamento.
3. **O binário nativo do `better-sqlite3` precisa ser recompilado para o
   Electron.** O Node do projeto e o Node embutido no Electron são versões
   diferentes (ABIs diferentes) — um `.node` compilado para uma não carrega
   na outra (`ERR_DLOPEN_FAILED`/`NODE_MODULE_VERSION`). `prepare-resources.mjs`
   já baixa o binário certo via `prebuild-install --runtime=electron`
   automaticamente, só na cópia usada pelo `.exe` (o `node_modules` do
   projeto continua intacto para `npm run dev`/`build`/testes). Por isso o
   Electron está fixado em `38.8.6`: é a versão mais recente para a qual o
   `better-sqlite3` publica um binário pré-compilado pronto — versões mais
   novas do Electron ainda não têm esse binário disponível, e recompilar do
   zero exigiria instalar o Visual Studio Build Tools nesta máquina. O
   `bcrypt` não precisa disso (usa N-API, estável entre versões do Node).

## Aviso sobre SmartScreen / política de execução do Windows

O `.exe` gerado **não é assinado digitalmente** (assinatura de código
Authenticode é um certificado pago, fora do escopo deste empacotamento).
Por isso:
- O Windows SmartScreen deve mostrar um aviso "O Windows protegeu o seu PC"
  na primeira execução — é normal para qualquer `.exe` não assinado; o
  usuário clica em "Mais informações" → "Executar assim mesmo".
- Em máquinas com política de **Controle de Aplicativos** mais restrita
  (comum em ambientes corporativos, e foi o caso desta própria máquina de
  build), o instalador pode ser **bloqueado** antes mesmo do SmartScreen
  aparecer. Se isso acontecer, a alternativa é distribuir a pasta
  `.DIST/win-unpacked/` inteira (copiada, por exemplo, via zip) e rodar
  `Genus Contabilidade.exe` de dentro dela — é o mesmo app, sem instalador,
  e usa a mesma pasta de dados.

## Resetar tudo (voltar ao estado de fábrica)

Apague `%APPDATA%\genus_contabilidade\` — o app recria o banco a partir do
template na próxima abertura. Isso apaga também os backups; para restaurar um
backup em vez de resetar, feche o app e copie o arquivo desejado de
`backups\` por cima de `genus.db`.
