-- AlterTable
-- Só adiciona colunas (sem recriar a tabela "Usuario"): seguro para bancos em uso.
ALTER TABLE "Usuario" ADD COLUMN "trocarSenha" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Usuario" ADD COLUMN "codigoRecuperacaoHash" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "codigoRecuperacaoEm" DATETIME;
