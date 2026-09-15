-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'USER';

-- O primeiro usuário criado pelo fluxo de configuração inicial é o administrador.
UPDATE "Usuario"
SET "role" = 'ADMIN'
WHERE "id" = (
    SELECT "id"
    FROM "Usuario"
    ORDER BY "createdAt" ASC, "id" ASC
    LIMIT 1
);
