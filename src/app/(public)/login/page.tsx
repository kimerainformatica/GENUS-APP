import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  const initialSetup = (await prisma.usuario.count()) === 0;

  return (
    <main className="flex min-h-screen bg-background">
      <section className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-foreground to-primary p-12 lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 -left-20 h-80 w-80 rounded-full bg-white/10" />
        <div className="relative z-10 max-w-md text-center text-white">
          <div className="mx-auto mb-8 flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl bg-white/15 p-3 shadow-2xl backdrop-blur-sm">
            <Image src="/logo_genus_contabilidade.jpeg" alt="Genus Contabilidade" width={128} height={128} className="h-full w-full rounded-xl object-contain" priority />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Genus Portal</h1>
          <p className="mt-3 text-lg font-medium text-white/70">Gestão contábil inteligente</p>
          <ul className="mt-12 space-y-4 text-left text-sm font-medium">
            <li>✦ Extração automática de extratos bancários</li>
            <li>✦ Análise de gastos, entradas e contrapartes</li>
            <li>✦ Reconciliação e gestão centralizada</li>
          </ul>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <Image src="/logo_genus_contabilidade.jpeg" alt="Genus Contabilidade" width={72} height={72} className="mx-auto mb-6 rounded-xl object-contain lg:hidden" priority />
          <div className="rounded-2xl border border-border bg-card p-8 shadow-xl shadow-border/40 sm:p-10">
            <div className="mb-8">
              <p className="text-sm font-semibold text-primary">{initialSetup ? "Configuração inicial" : "Acesso seguro"}</p>
              <h2 className="mt-1 text-2xl font-bold text-foreground">{initialSetup ? "Crie o administrador" : "Bem-vindo de volta"}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{initialSetup ? "Este cadastro só fica disponível enquanto não existe nenhum usuário." : "Entre com suas credenciais para continuar."}</p>
            </div>
            <LoginForm initialSetup={initialSetup} />
          </div>
        </div>
      </section>
    </main>
  );
}
