import Image from "next/image";
import Link from "next/link";
import { KeyRound, Users } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";
import { requireSession } from "@/lib/auth/session";

export default async function RestricLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo_genus_contabilidade.jpeg"
              alt="Genus Contabilidade"
              width={44}
              height={44}
              className="rounded-lg object-contain"
              priority
            />
            <div>
              <p className="font-bold text-foreground">Genus Portal</p>
              <p className="text-xs text-muted-foreground">Gestão contábil</p>
            </div>
          </div>
          <AppNav />
          <div className="flex items-center gap-3">
            {session.user.role === "ADMIN" && (
              <Button nativeButton={false} render={<Link href="/admin/usuarios" aria-label="Gerenciar usuários" />}>
                <Users size={17} aria-hidden="true" />
                <span className="hidden xl:inline">Usuários</span>
              </Button>
            )}
            <Link href="/conta" title="Minha conta: alterar senha" className="hidden rounded-lg px-2 py-1 text-right text-xs transition-colors hover:bg-muted sm:block">
              <span className="block font-semibold text-foreground">{session.user.name}</span>
              <span className="text-muted-foreground">
                {session.user.email} · {session.user.role === "ADMIN" ? "Administrador" : "Usuário"}
              </span>
            </Link>
            <form action={logout}>
              <button type="submit" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Sair</button>
            </form>
          </div>
        </div>
      </header>
      {session.user.role === "ADMIN" && !session.user.temCodigoRecuperacao && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 print:hidden">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3 text-sm text-amber-900">
            <p className="flex items-center gap-2">
              <KeyRound size={16} aria-hidden="true" />
              Você ainda não tem um código de recuperação. Sem ele, se esquecer a senha, não há como recuperar o acesso de administrador.
            </p>
            <Link href="/conta#recuperacao" className="shrink-0 font-semibold underline underline-offset-2">
              Gerar agora
            </Link>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
