"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Upload, UploadCloud, X, XCircle } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { importExtratoPdf, type ImportExtratoResult } from "@/lib/actions/import-extrato";

const SUPPORTED_BANKS = ["Santander", "Bradesco", "Itaú", "Inter", "Nubank", "Mercado Pago", "PicPay"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;

type ClienteOption = { id: string; nome: string };

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadExtratoDialog({
  clientes,
  defaultClienteId,
}: {
  clientes: ClienteOption[];
  defaultClienteId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clienteId, setClienteId] = useState(defaultClienteId ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ImportExtratoResult[]>([]);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const invalid = incoming.some((f) => f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf"));
    if (invalid) {
      setError("Só é possível enviar arquivos em PDF.");
      return;
    }
    if (incoming.some((file) => file.size > MAX_FILE_SIZE)) {
      setError("Cada PDF pode ter no máximo 10 MB.");
      return;
    }
    if (files.length + incoming.length > MAX_FILES) {
      setError(`Envie no máximo ${MAX_FILES} PDFs por vez.`);
      return;
    }
    setError(null);
    setFiles((prev) => [...prev, ...incoming.filter((file) => !prev.some((current) => current.name === file.name && current.size === file.size))]);
  }

  function reset() {
    setFiles([]);
    setError(null);
    setResults([]);
    setDragActive(false);
    setClienteId(defaultClienteId ?? "");
  }

  function handleImport() {
    if (!clienteId) {
      setError("Selecione o cliente antes de importar.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const done: ImportExtratoResult[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.set("clienteId", clienteId);
        formData.set("file", file);
        const result = await importExtratoPdf(formData);
        done.push(result);
        setResults([...done]);
      }
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger className={buttonVariants({ variant: "outline" })}>
        <Upload size={16} aria-hidden="true" />
        Importar extrato
      </DialogTrigger>

      <DialogContent>
        <DialogTitle>Importar extrato bancário</DialogTitle>
        <DialogDescription>
          Envie o PDF do extrato. O bot de importação identifica o banco, lê os lançamentos e já salva tudo no
          cliente escolhido.
        </DialogDescription>

        <label className="mt-4 flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground">Cliente</span>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            disabled={pending || results.length > 0}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-muted disabled:text-muted-foreground"
          >
            <option value="">Selecione um cliente…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>

        <div
          className={`mt-3 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
            dragActive ? "border-primary bg-primary/5" : "border-border bg-muted/40"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <UploadCloud size={28} className="text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-foreground">
            Arraste o PDF aqui ou{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              escolha um arquivo
            </button>
          </p>
          <p className="text-xs text-muted-foreground">PDF de até 10 MB · {SUPPORTED_BANKS.join(", ")}</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {error && <p className="mt-2 text-xs font-medium text-destructive">{error}</p>}

        {files.length > 0 && results.length === 0 && (
          <ul className="mt-3 flex max-h-40 flex-col gap-1.5 overflow-y-auto">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-xs"
              >
                <FileText size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex-1 truncate text-foreground">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">{formatFileSize(file.size)}</span>
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remover ${file.name}`}
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {results.length > 0 && (
          <ul className="mt-3 flex max-h-52 flex-col gap-1.5 overflow-y-auto">
            {results.map((r, i) => (
              <li
                key={`${r.fileName}-${i}`}
                className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                  r.success ? "border-emerald-600/20 bg-emerald-600/5" : "border-destructive/20 bg-destructive/5"
                }`}
              >
                {r.success ? (
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
                ) : (
                  <XCircle size={14} className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{r.fileName}</p>
                  {r.success ? (
                    <p className="text-muted-foreground">
                      {r.banco} · {r.transacoesCount} lançamento{r.transacoesCount === 1 ? "" : "s"}
                      {r.reconciliacaoOk === true && " · saldo confere"}
                      {r.reconciliacaoOk === false && " · [atenção] saldo não confere"}
                    </p>
                  ) : (
                    <p className="text-destructive">{r.error}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <DialogClose className={buttonVariants({ variant: "ghost" })}>
            {results.length > 0 ? "Fechar" : "Cancelar"}
          </DialogClose>
          {results.length === 0 && (
            <Button type="button" disabled={files.length === 0 || pending} onClick={handleImport}>
              {pending ? "Importando…" : "Importar extrato"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
