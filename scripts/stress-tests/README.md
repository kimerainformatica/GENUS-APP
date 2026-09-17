# Protocolo de testes de carga, concorrência e resiliência a falhas

Este diretório contém um protocolo automatizado para validar que o Genus
Contabilidade **não perde nem corrompe dados** sob carga pesada, acesso
concorrente ao banco, ou interrupções abruptas (queda de energia,
travamento do processo, outro programa mexendo no arquivo `dev.db` ao
mesmo tempo).

## Como o app guarda dados hoje

- Banco: SQLite (arquivo `dev.db`) via `better-sqlite3`, acessado pelo Prisma
  através do adapter `@prisma/adapter-better-sqlite3` (`src/lib/prisma.ts`).
- Nenhum PRAGMA customizado é aplicado — o app roda com os **padrões do
  better-sqlite3**: `synchronous=FULL` (mais seguro contra corrupção,
  cada commit é confirmado em disco antes de retornar) e
  `busy_timeout=5000ms` (uma escrita concorrente espera até 5s pelo lock
  antes de falhar com `SQLITE_BUSY`). O modo de journal é o `DELETE`
  padrão do SQLite (rollback journal), não WAL.
- Escritas com múltiplas tabelas (ex.: importar um extrato cria 1 `Extrato`
  + N `Transacao`) usam `prisma.extrato.create({ data: { transacoes: { create: [...] } } })`
  ou `prisma.$transaction(...)`, que o Prisma executa como uma única
  transação SQLite — ou tudo é gravado, ou nada é.
- Login tem limitação de tentativas (`src/lib/actions/auth.ts`), mas o
  contador fica em memória do processo (reseta se o servidor reiniciar) e é
  por e-mail, não por IP — suficiente contra força bruta comum, mas não
  contra um ataque distribuído com muitos e-mails. Não é um bug a corrigir
  neste momento, apenas uma limitação a ter em mente.

Essa combinação (`synchronous=FULL` + journal padrão) é, por si só, a
configuração **mais segura** que o SQLite oferece contra perda de dados em
caso de queda de energia — o preço é menos concorrência (só um escritor por
vez). Os testes abaixo confirmam isso na prática, não só na teoria.

## Importante: isto NÃO é um ataque de DDoS de verdade

"DDoS" no pedido foi interpretado como **teste de carga local e autorizado**
contra a própria instância de desenvolvimento do app — é assim que se testa
estabilidade sob tráfego pesado de forma legítima. Nenhum script aqui envia
tráfego para fora desta máquina, nem deve ser apontado para um domínio de
produção ou de terceiros sem autorização explícita.

## Segurança dos testes: o `dev.db` real nunca é tocado

Todo teste começa copiando `dev.db` para um arquivo isolado em
`scripts/stress-tests/.tmp/` e só opera nessa cópia. O servidor de teste
(protocolo 01) sobe numa **porta separada** (3979 por padrão) e num
**diretório de build separado** (`.next-stress-test`), então não interfere
com uma instância real do `next dev` que porventura já esteja rodando.
Se um teste passa, a cópia usada é apagada; se falha, ela é **preservada**
em `.tmp/` para você abrir num DB Browser for SQLite e investigar.

## Os três protocolos

### 1. Carga concorrente + acesso externo ao banco (`01-load-concurrency-test.mjs`)
Sobe uma segunda instância do app e dispara ondas de requisições
simultâneas contra páginas públicas, tentativas de login (válidas e
inválidas) e páginas autenticadas (dashboard, clientes), enquanto, ao mesmo
tempo, abre e fecha conexões externas com o arquivo do banco repetidamente
(simulando um antivírus, backup, ou alguém com o DB Browser aberto).
Mede taxa de erro, latência (p50/p90/p99) e roda `integrity_check` no final.

```
npm run test:load
# ajustar intensidade:
LOAD_WAVES=10 LOAD_CONCURRENCY=80 npm run test:load
```

### 2. Interrupção abrupta / simulação de queda de energia (`02-crash-interruption-test.mjs`)
Um processo fica escravando lotes `Cliente -> Extrato -> N Transacao`
(o mesmo padrão do import real de extratos) sem parar. O processo pai mata
esse processo na marra (`SIGKILL`, não interceptável — no Windows o Node
traduz isso em `TerminateProcess`, que é o equivalente mais próximo e seguro
de simular um desligamento abrupto do computador sem precisar desligar a
máquina de verdade) em instantes aleatórios e imprevisíveis, repetindo por
vários ciclos. Depois de cada morte, verifica:

- `PRAGMA integrity_check` / `foreign_key_check` (corrupção de arquivo);
- que todo `Extrato` tem exatamente o número de `Transacao` esperado
  (nenhuma escrita parcial sobrevive);
- que não sobrou nenhum `Extrato` órfão sem `Cliente`.

```
npm run test:crash
# mais agressivo (mais ciclos, lotes maiores = transações mais longas = mais chance da morte cair no meio):
STRESS_CYCLES=50 STRESS_BATCH_SIZE=500 npm run test:crash
```

### 3. Abrir/fechar o banco externamente durante o uso (`03-lock-contention-test.mjs`)
Um escritor contínuo do app roda ao mesmo tempo que um processo externo
abre o arquivo, segura o lock de escrita (`BEGIN IMMEDIATE`) por um tempo
aleatório, e fecha — repetidamente. Isto é diferente do teste 2: aqui
ninguém morre, é só disputa normal de lock (`SQLITE_BUSY`/`SQLITE_LOCKED`).
Passa se o app continuar progredindo (não trava por completo) e o arquivo
seguir íntegro; erros de lock são esperados e não contam como falha.

```
npm run test:lock
LOCK_TEST_DURATION_MS=60000 npm run test:lock
```

### Rodar tudo em sequência
```
npm run test:stress
```

## Como ler o resultado

Cada script imprime um "VEREDITO" (PASSOU/FALHOU) e grava um JSON em
`scripts/stress-tests/reports/`. `run-all.mjs` roda os três e imprime um
resumo consolidado no final.

**Critério de reprovação real (indica bug, não é "esperado do SQLite"):**
- `integrity_check` retornando qualquer coisa diferente de `ok`;
- um `Extrato` com número de `Transacao` diferente do esperado (escrita
  parcial — quebraria a garantia de atomicidade);
- `Extrato` órfão (sem `Cliente`);
- resposta HTTP 5xx do app, ou o servidor caindo sozinho durante a carga;
- erro do escritor que não seja `SQLITE_BUSY`/`SQLITE_LOCKED`.

**O que é esperado e não é falha:**
- `SQLITE_BUSY`/`SQLITE_LOCKED` durante os testes 1 e 3 (é o SQLite fazendo
  seu trabalho: só um escritor por vez);
- latência alta no teste 1 rodando com `next dev` (compilação sob demanda) —
  para medir latência realista, rode contra `next build && next start`
  apontando `STRESS_TEST_DIST_DIR`/`DATABASE_URL` para o mesmo esquema, ou
  ajuste o protocolo 01 para usar `next start`.

## Testes manuais que os scripts não substituem

Alguns cenários do pedido original só fazem sentido feitos manualmente,
com cuidado, porque envolvem desligar hardware de verdade:

1. **Desligamento real do computador durante uma gravação**: importe um
   extrato grande no app e desligue a máquina no botão físico (ou tire da
   tomada, se for desktop sem nobreak) bem no meio da importação. Ao
   religar, rode `sqlite3 dev.db "PRAGMA integrity_check;"` (ou o script de
   integridade abaixo) antes de abrir o app de novo.
2. **Interrupção de rede/energia com o navegador aberto**: comece a
   preencher um formulário longo (cadastro de cliente), derrube o Wi-Fi no
   meio do envio, reconecte e confira se os dados já salvos continuam
   íntegros e se a UI se recupera sem duplicar o registro.

Para checar a integridade do `dev.db` real a qualquer momento (sem alterar
nada, é só leitura):
```
node -e "const D=require('better-sqlite3'); const db=new D('dev.db',{readonly:true}); console.log(db.pragma('integrity_check')); db.close();"
```

## Recomendação opcional (não aplicada automaticamente)

Se no futuro a concorrência de escrita virar um problema real (muitos
usuários importando extratos ao mesmo tempo), considere ativar
`journal_mode=WAL` em `src/lib/prisma.ts` — permite leitores concorrentes
enquanto alguém escreve, às custas de gerenciar os arquivos extras
`dev.db-wal`/`dev.db-shm` (já cobertos pelo `.gitignore`). Isso não foi
aplicado aqui porque a configuração atual (`synchronous=FULL` + journal
padrão) é a mais conservadora possível contra corrupção, e os três testes
acima confirmam que ela aguenta carga, concorrência e mortes abruptas sem
perder dados — trocar para WAL é uma otimização de desempenho, não uma
correção de um problema encontrado.
