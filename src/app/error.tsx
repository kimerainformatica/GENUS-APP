"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

// Sem este arquivo, um erro inesperado ao montar uma página mostrava a tela
// padrão do Next.js em inglês ("Application error"), sem caminho de volta.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[página] erro inesperado:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <CircleAlert size={40} className="text-destructive" aria-hidden="true" />
      <div>
        <h1 className="text-2xl font-bold text-foreground">Algo deu errado ao abrir esta página</h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Tente de novo. Se o problema continuar, feche e abra o Genus Contabilidade.
          {error.digest && <span className="mt-1 block text-xs">Código do erro: {error.digest}</span>}
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={reset}>
          Tentar de novo
        </Button>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Ir para o dashboard
        </Link>
      </div>
    </main>
  );
}
