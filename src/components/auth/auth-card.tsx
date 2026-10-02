import Image from "next/image";

/** Moldura das telas fora da área logada (trocar senha obrigatória, recuperar acesso). */
export function AuthCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 sm:p-8">
      <div className="w-full max-w-md">
        <Image src="/logo_genus_contabilidade.jpeg" alt="Genus Contabilidade" width={72} height={72} className="mx-auto mb-6 rounded-xl object-contain" priority />
        <div className="rounded-2xl border border-border bg-card p-8 shadow-xl shadow-border/40 sm:p-10">
          <div className="mb-6">
            <p className="text-sm font-semibold text-primary">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}
