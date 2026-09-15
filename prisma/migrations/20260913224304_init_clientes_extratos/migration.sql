-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "cpfCnpj" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Extrato" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clienteId" TEXT NOT NULL,
    "instituicao" TEXT,
    "agencia" TEXT,
    "conta" TEXT,
    "periodoInicio" DATETIME,
    "periodoFim" DATETIME,
    "saldoInicial" REAL,
    "saldoFinal" REAL,
    "totalEntradas" REAL,
    "totalSaidas" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Extrato_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transacao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "extratoId" TEXT NOT NULL,
    "data" DATETIME NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "identificador" TEXT,
    "valor" REAL NOT NULL,
    "saldoApos" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transacao_extratoId_fkey" FOREIGN KEY ("extratoId") REFERENCES "Extrato" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Extrato_clienteId_idx" ON "Extrato"("clienteId");

-- CreateIndex
CREATE INDEX "Transacao_extratoId_idx" ON "Transacao"("extratoId");
