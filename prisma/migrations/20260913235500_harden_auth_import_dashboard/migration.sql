-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Sessao" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "usuarioId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Sessao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable: metadados de importação e reconciliação
ALTER TABLE "Extrato" ADD COLUMN "arquivoNome" TEXT;
ALTER TABLE "Extrato" ADD COLUMN "arquivoHash" TEXT;
ALTER TABLE "Extrato" ADD COLUMN "periodoDeclarado" TEXT;
ALTER TABLE "Extrato" ADD COLUMN "somaCalculada" REAL;
ALTER TABLE "Extrato" ADD COLUMN "reconciliacaoOk" BOOLEAN;
ALTER TABLE "Extrato" ADD COLUMN "origem" TEXT NOT NULL DEFAULT 'MANUAL';

-- AlterTable: detalhes fornecidos pelo extrator e categoria contábil
ALTER TABLE "Transacao" ADD COLUMN "tipoOperacao" TEXT;
ALTER TABLE "Transacao" ADD COLUMN "categoria" TEXT NOT NULL DEFAULT 'Outros';
ALTER TABLE "Transacao" ADD COLUMN "valorBruto" REAL;
ALTER TABLE "Transacao" ADD COLUMN "secao" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");
CREATE UNIQUE INDEX "Sessao_tokenHash_key" ON "Sessao"("tokenHash");
CREATE INDEX "Sessao_usuarioId_idx" ON "Sessao"("usuarioId");
CREATE INDEX "Sessao_expiresAt_idx" ON "Sessao"("expiresAt");
CREATE UNIQUE INDEX "Cliente_cpfCnpj_key" ON "Cliente"("cpfCnpj");
CREATE INDEX "Extrato_periodoInicio_periodoFim_idx" ON "Extrato"("periodoInicio", "periodoFim");
CREATE UNIQUE INDEX "Extrato_clienteId_arquivoHash_key" ON "Extrato"("clienteId", "arquivoHash");
CREATE INDEX "Transacao_data_idx" ON "Transacao"("data");
CREATE INDEX "Transacao_categoria_idx" ON "Transacao"("categoria");
