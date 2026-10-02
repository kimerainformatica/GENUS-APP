import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <FileQuestion size={40} className="text-muted-foreground" aria-hidden="true" />
      <div>
        <h1 className="text-2xl font-bold text-foreground">Página não encontrada</h1>
        <p className="mt-2 text-sm text-muted-foreground">O cliente, extrato ou página que você procurou não existe ou foi excluído.</p>
      </div>
      <Button nativeButton={false} render={<Link href="/dashboard" />}>
        Voltar ao dashboard
      </Button>
    </main>
  );
}
