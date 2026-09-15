import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  FileText,
  Landmark,
  Mail,
  Pencil,
  Phone,
  ReceiptText,
  WalletCards,
} from "lucide-react";
import { ClienteFormDialog } from "@/components/clientes/cliente-form-dialog";
import { UploadExtratoDialog } from "@/components/upload-extrato-dialog";
import { PageBack } from "@/components/navigation/page-back";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/lib/auth/session";
import { formatCurrency, sumMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { optionalIdField } from "@/lib/validation";

function formatDate(value: Date | null): string {
  return value ? value.toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
}

function importStatus(origin: string, reconciliation: boolean | null) {
  if (origin !== "IMPORTADO") return { label: "Manual", className: "bg-muted text-muted-foreground" };
  if (reconciliation === true) return { label: "Conciliado", className: "bg-emerald-600/10 text-emerald-700" };
  if (reconciliation === false) return { label: "Divergente", className: "bg-destructive/10 text-destructive" };
  return { label: "Sem conferência", className: "bg-amber-500/10 text-amber-700" };
}

export default async function ClienteProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id: rawId } = await params;
  const id = optionalIdField(rawId);
  if (!id) notFound();

  const cliente = await prisma.cliente.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      cpfCnpj: true,
      email: true,
      telefone: true,
      createdAt: true,
      extratos: {
        orderBy: [{ periodoFim: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          instituicao: true,
          agencia: true,
          conta: true,
          periodoInicio: true,
          periodoFim: true,
          saldoFinal: true,
          totalEntradas: true,
          totalSaidas: true,
          origem: true,
          reconciliacaoOk: true,
          arquivoNome: true,
          createdAt: true,
          _count: { select: { transacoes: true } },
        },
      },
    },
  });

  if (!cliente) notFound();

  const totalEntradas = sumMoney(cliente.extratos.map((item) => item.totalEntradas ?? 0));
  const totalSaidas = sumMoney(cliente.extratos.map((item) => item.totalSaidas ?? 0));
  const movimentacoes = cliente.extratos.reduce((total, item) => total + item._count.transacoes, 0);
  const bancos = new Set(cliente.extratos.map((item) => item.instituicao).filter(Boolean)).size;
  const latestAccountBalance = new Map<string, number>();
  for (const extrato of cliente.extratos) {
    if (extrato.saldoFinal === null) continue;
    const accountKey = `${extrato.instituicao ?? "Banco"}|${extrato.agencia ?? ""}|${extrato.conta ?? ""}`;
    if (!latestAccountBalance.has(accountKey)) latestAccountBalance.set(accountKey, extrato.saldoFinal);
  }
  const saldoConsolidado = sumMoney([...latestAccountBalance.values()]);
  const initials = cliente.nome.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const clienteOption = [{ id: cliente.id, nome: cliente.nome }];

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 sm:py-10">
      <PageBack href="/clientes" label="Voltar para clientes" />

      <section className="mt-5 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-7">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-primary">Perfil do cliente</p>
              <h1 className="mt-1 truncate text-2xl font-bold text-foreground sm:text-3xl">{cliente.nome}</h1>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{cliente.cpfCnpj ?? "CPF/CNPJ não informado"}</span>
                <span className="inline-flex items-center gap-1"><CalendarDays size={14} /> Cliente desde {formatDate(cliente.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" nativeButton={false} render={<Link href={`/dashboard?clienteId=${cliente.id}`} />}>
              Ver dashboard <ArrowUpRight size={15} />
            </Button>
            <ClienteFormDialog
              cliente={cliente}
              trigger={<Button variant="outline"><Pencil size={15} /> Editar</Button>}
            />
            <UploadExtratoDialog clientes={clienteOption} defaultClienteId={cliente.id} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex items-center gap-3 text-sm text-muted-foreground"><Mail size={16} /><span className="truncate">{cliente.email ?? "E-mail não informado"}</span></div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground"><Phone size={16} /><span>{cliente.telefone ?? "Telefone não informado"}</span></div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground"><Landmark size={16} /><span>{bancos} banco(s) identificado(s)</span></div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Extratos", value: String(cliente.extratos.length), icon: FileText },
          { label: "Movimentações", value: String(movimentacoes), icon: WalletCards },
          { label: "Total de entradas", value: formatCurrency(totalEntradas), icon: ArrowUpRight },
          { label: "Total de gastos", value: formatCurrency(totalSaidas), icon: ReceiptText },
          { label: "Saldo mais recente", value: latestAccountBalance.size ? formatCurrency(saldoConsolidado) : "—", icon: Landmark },
        ].map(({ label, value, icon: Icon }) => (
          <article key={label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <Icon size={18} className="text-primary" aria-hidden="true" />
            <p className="mt-3 truncate text-xl font-bold text-foreground" title={value}>{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{label}</p>
          </article>
        ))}
      </section>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">Histórico bancário</p>
            <h2 className="mt-1 text-xl font-bold text-foreground">Extratos vinculados</h2>
            <p className="mt-1 text-sm text-muted-foreground">Todos os PDFs e extratos manuais associados a este cliente.</p>
          </div>
          <Badge variant="secondary">{cliente.extratos.length} registro(s)</Badge>
        </div>

        {cliente.extratos.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card py-14 text-center">
            <Building2 size={28} className="text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">Nenhum extrato vinculado.</p>
            <p className="mt-1 text-xs text-muted-foreground">Use &ldquo;Importar PDFs&rdquo; para iniciar o histórico deste cliente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Banco / arquivo</th>
                  <th className="px-5 py-3 font-medium">Período</th>
                  <th className="px-5 py-3 font-medium">Movimentações</th>
                  <th className="px-5 py-3 text-right font-medium">Entradas</th>
                  <th className="px-5 py-3 text-right font-medium">Gastos</th>
                  <th className="px-5 py-3 text-right font-medium">Saldo final</th>
                  <th className="px-5 py-3 text-right font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {cliente.extratos.map((extrato) => {
                  const status = importStatus(extrato.origem, extrato.reconciliacaoOk);
                  return (
                    <tr key={extrato.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40">
                      <td className="px-5 py-3.5">
                        <Link href={`/extratos/${extrato.id}`} className="group inline-flex items-center gap-2 font-semibold text-foreground hover:text-primary">
                          {extrato.instituicao ?? "Extrato"}
                          <ArrowUpRight size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                        <p className="mt-0.5 max-w-64 truncate text-xs text-muted-foreground">{extrato.arquivoNome ?? `${extrato.agencia ?? "Agência —"} / ${extrato.conta ?? "Conta —"}`}</p>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground [font-variant-numeric:tabular-nums]">{formatDate(extrato.periodoInicio)} a {formatDate(extrato.periodoFim)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{extrato._count.transacoes}</td>
                      <td className="px-5 py-3.5 text-right font-medium text-primary [font-variant-numeric:tabular-nums]">{formatCurrency(extrato.totalEntradas ?? 0)}</td>
                      <td className="px-5 py-3.5 text-right font-medium text-destructive [font-variant-numeric:tabular-nums]">{formatCurrency(extrato.totalSaidas ?? 0)}</td>
                      <td className="px-5 py-3.5 text-right font-medium text-foreground [font-variant-numeric:tabular-nums]">{extrato.saldoFinal === null ? "—" : formatCurrency(extrato.saldoFinal)}</td>
                      <td className="px-5 py-3.5 text-right"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
