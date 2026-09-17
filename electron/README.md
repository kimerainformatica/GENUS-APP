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
3. `electron-builder` — empacota tudo num `.exe` Windows portátil, gerado em
   **`.DIST/Genus Contabilidade <versão>.exe`** (e a versão "descompactada"
   equivalente em `.DIST/win-unpacked/`).

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
  build), o `.exe` portátil pode ser **bloqueado** antes mesmo do
  SmartScreen aparecer. Se isso acontecer, a alternativa é distribuir a
  pasta `.DIST/win-unpacked/` inteira (copiada, por exemplo, via zip) e
  rodar `Genus Contabilidade.exe` de dentro dela — é o mesmo app, sem o
  empacotador NSIS de arquivo único, e não esbarrou nessa política durante
  os testes.

## Resetar tudo (voltar ao estado de fábrica)

Apague `%APPDATA%\genus_contabilidade\` — o app recria o banco a partir do
template na próxima abertura.
