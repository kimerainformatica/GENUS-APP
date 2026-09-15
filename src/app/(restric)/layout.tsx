import Image from "next/image";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/actions/auth";
import { requireSession } from "@/lib/auth/session";

export default async function RestricLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
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
              <Button nativeButton={false} render={<Link href="/admin/criar-usuario" aria-label="Criar novo usuário" />}>
                <UserPlus size={17} aria-hidden="true" />
                <span className="hidden xl:inline">Novo usuário</span>
              </Button>
            )}
            <p className="hidden text-right text-xs sm:block">
              <span className="block font-semibold text-foreground">{session.user.name}</span>
              <span className="text-muted-foreground">
                {session.user.email} · {session.user.role === "ADMIN" ? "Administrador" : "Usuário"}
              </span>
            </p>
            <form action={logout}>
              <button type="submit" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Sair</button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
