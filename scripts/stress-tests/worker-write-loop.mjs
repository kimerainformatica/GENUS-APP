// Processo filho usado pelo teste de interrupção abrupta (02-crash-interruption-test.mjs).
// Fica escrevendo, sem parar, lotes "Extrato + N Transacao" dentro de uma única
// transação SQLite (o mesmo padrão de src/lib/actions/import-extrato.ts), até
// que o processo pai o mate (SIGKILL) a qualquer momento. O objetivo é que a
// morte caia no meio de uma transação com a maior frequência possível.
//
// uso: node worker-write-loop.mjs <caminhoDoBanco> [transacoesPorLote]

import Database from "better-sqlite3";

const dbPath = process.argv[2];
const transacoesPorLote = Number(process.argv[3] ?? 300);
if (!dbPath) {
  console.error("uso: worker-write-loop.mjs <caminhoDoBanco> [transacoesPorLote]");
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const CLIENTE_ID = "stress-test-cliente-fixo";

function isoNow() {
  return new Date().toISOString();
}

function ensureCliente() {
  const existing = db.prepare("SELECT id FROM Cliente WHERE id = ?").get(CLIENTE_ID);
  if (!existing) {
    const ts = isoNow();
    db.prepare(
      `INSERT INTO Cliente (id, nome, cpfCnpj, email, telefone, createdAt, updatedAt)
       VALUES (?, ?, NULL, NULL, NULL, ?, ?)`,
    ).run(CLIENTE_ID, "STRESS TEST - registro sintético, não é cliente real", ts, ts);
  }
}
ensureCliente();

const insertExtrato = db.prepare(`
  INSERT INTO Extrato (
    id, clienteId, instituicao, periodoInicio, periodoFim, saldoInicial, saldoFinal,
    totalEntradas, totalSaidas, arquivoNome, arquivoHash, periodoDeclarado, somaCalculada,
    reconciliacaoOk, origem, createdAt, updatedAt
  ) VALUES (
    @id, @clienteId, 'STRESS', @ts, @ts, 0, 0, 0, 0, @arquivoNome, @arquivoHash, NULL, 0, 1,
    'MANUAL', @ts, @ts
  )
`);

const insertTransacao = db.prepare(`
  INSERT INTO Transacao (
    id, extratoId, data, tipo, tipoOperacao, categoria, descricao, identificador,
    nomeContraparte, tarifaTaxa, valorBruto, valor, saldoApos, secao, createdAt
  ) VALUES (
    @id, @extratoId, @ts, 'CREDITO', NULL, 'Outros', @descricao, NULL, NULL, 0, @valor, @valor, NULL, NULL, @ts
  )
`);

const writeBatch = db.transaction((batchId, n) => {
  const ts = isoNow();
  const extratoId = `stress-${batchId}`;
  insertExtrato.run({ id: extratoId, clienteId: CLIENTE_ID, arquivoNome: `stress-${batchId}.pdf`, arquivoHash: batchId, ts });
  for (let i = 0; i < n; i++) {
    insertTransacao.run({ id: `${extratoId}-t${i}`, extratoId, descricao: `Lançamento stress ${i}`, valor: i + 1, ts });
  }
  return extratoId;
});

let seq = 0;
while (true) {
  seq += 1;
  const batchId = `${process.pid}-${Date.now()}-${seq}`;
  try {
    const extratoId = writeBatch(batchId, transacoesPorLote);
    process.stdout.write(`OK ${extratoId} ${transacoesPorLote}\n`);
  } catch (error) {
    process.stdout.write(`ERR ${error.code ?? "?"} ${String(error.message).replace(/\s+/g, " ")}\n`);
  }
}
