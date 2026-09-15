import Link from "next/link";
import { ArrowUpRight, Pencil, Plus, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { deleteCliente } from "@/lib/actions/clientes";
import { ClienteFormDialog } from "@/components/clientes/cliente-form-dialog";
import { DeleteButton } from "@/components/delete-button";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";

export default async function ClientesPage() {
  await requireSession();
  const clientes = await prisma.cliente.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { extratos: true } } },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">Cadastros</p>
          <h1 className="mt-1 text-3xl font-bold text-foreground">Clientes</h1>
          <p className="mt-2 text-muted-foreground">Pessoas físicas e empresas (CNPJ) atendidas pela contabilidade.</p>
        </div>
        <ClienteFormDialog
          trigger={
            <Button>
              <Plus size={16} aria-hidden="true" />
              Novo cliente
            </Button>
          }
        />
      </div>

      {clientes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <Users size={28} className="text-muted-foreground" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Nenhum cliente cadastrado ainda.</p>
          <p className="text-xs text-muted-foreground">Cadastre um cliente para depois importar os extratos bancários dele.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Nome / Razão social</th>
                <th className="px-5 py-3 font-medium">CPF / CNPJ</th>
                <th className="px-5 py-3 font-medium">Contato</th>
                <th className="px-5 py-3 font-medium">Extratos</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((cliente) => (
                <tr key={cliente.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                  <td className="px-5 py-3.5 font-medium text-foreground">
                    <Link href={`/clientes/${cliente.id}`} className="hover:text-primary hover:underline hover:underline-offset-4">
                      {cliente.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground [font-variant-numeric:tabular-nums]">{cliente.cpfCnpj ?? "—"}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">
                    {cliente.email || cliente.telefone ? (
                      <div className="flex flex-col text-xs">
                        {cliente.email && <span>{cliente.email}</span>}
                        {cliente.telefone && <span>{cliente.telefone}</span>}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{cliente._count.extratos}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link href={`/clientes/${cliente.id}`} aria-label={`Ver perfil de ${cliente.nome}`} />}>
                        <ArrowUpRight size={15} />
                      </Button>
                      <ClienteFormDialog
                        cliente={cliente}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Editar ${cliente.nome}`}>
                            <Pencil size={15} />
                          </Button>
                        }
                      />
                      <DeleteButton itemLabel={cliente.nome} onDelete={deleteCliente.bind(null, cliente.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
