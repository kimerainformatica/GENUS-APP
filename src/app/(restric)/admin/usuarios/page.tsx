import Link from "next/link";
import { KeyRound, ShieldCheck, UserPlus, Users } from "lucide-react";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function UsuariosPage() {
  const session = await requireAdmin();
  const usuarios = await prisma.usuario.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: { id: true, nome: true, email: true, role: true, ativo: true, trocarSenha: true, codigoRecuperacaoHash: true, createdAt: true },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <ShieldCheck size={16} aria-hidden="true" />
            Área administrativa
          </p>
          <h1 className="mt-1 text-3xl font-bold text-foreground">Usuários</h1>
          <p className="mt-2 text-muted-foreground">Quem acessa o Genus Portal: redefinir senha, mudar cargo e ativar ou desativar acessos.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/admin/criar-usuario" />}>
          <UserPlus size={16} aria-hidden="true" />
          Novo usuário
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="px-5 py-3 font-medium">Nome / e-mail</th>
              <th className="px-5 py-3 font-medium">Cargo</th>
              <th className="px-5 py-3 font-medium">Situação</th>
              <th className="px-5 py-3 font-medium text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((usuario) => {
              const isSelf = usuario.id === session.user.id;
              const isAdmin = usuario.role === "ADMIN";
              return (
                <tr key={usuario.id} className={`border-b border-border/60 last:border-0 ${usuario.ativo ? "" : "bg-muted/40"}`}>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-foreground">
                      {usuario.nome}
                      {isSelf && <span className="ml-2 text-xs font-normal text-muted-foreground">(você)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{usuario.email}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "Administrador" : "Usuário comum"}</Badge>
                    {isAdmin && !usuario.codigoRecuperacaoHash && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                        <KeyRound size={12} aria-hidden="true" />
                        Sem código de recuperação
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {usuario.ativo ? (
                      <span className="rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs font-medium text-emerald-700">Ativo</span>
                    ) : (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">Desativado</span>
                    )}
                    {usuario.trocarSenha && <p className="mt-1 text-xs text-amber-700">Senha temporária — troca pendente</p>}
                  </td>
                  <td className="px-5 py-3.5">
                    {isSelf ? (
                      <div className="flex justify-end">
                        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/conta" />}>
                          Minha conta
                        </Button>
                      </div>
                    ) : (
                      <UserRowActions id={usuario.id} nome={usuario.nome} role={usuario.role} ativo={usuario.ativo} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users size={13} aria-hidden="true" />
        O app nunca fica sem administrador ativo: o último não pode ser desativado nem virar usuário comum.
      </p>
    </main>
  );
}
