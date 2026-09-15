"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, CircleAlert, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Role = "ADMIN" | "USER";

type ApiResponse = {
  error?: string;
  message?: string;
};

export function CreateUserForm() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("USER");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome, email, password, role }),
        });
        const data = (await response.json()) as ApiResponse;

        if (!response.ok) {
          setFeedback({ type: "error", message: data.error ?? "Não foi possível criar o usuário." });
          return;
        }

        setNome("");
        setEmail("");
        setPassword("");
        setRole("USER");
        setFeedback({ type: "success", message: data.message ?? "Usuário criado com sucesso." });
      } catch {
        setFeedback({ type: "error", message: "Não foi possível conectar ao servidor." });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-8">
      {feedback && (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-600/20 bg-emerald-600/10 text-emerald-700"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 size={17} className="shrink-0" aria-hidden="true" />
          ) : (
            <CircleAlert size={17} className="shrink-0" aria-hidden="true" />
          )}
          {feedback.message}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium text-foreground sm:col-span-2">
          Nome
          <Input
            name="nome"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            autoComplete="name"
            minLength={2}
            maxLength={120}
            required
            placeholder="Nome completo"
            className="mt-1.5 h-11 rounded-xl bg-muted/40 px-4"
          />
        </label>

        <label className="block text-sm font-medium text-foreground sm:col-span-2">
          E-mail
          <Input
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            maxLength={254}
            required
            placeholder="nome@empresa.com.br"
            className="mt-1.5 h-11 rounded-xl bg-muted/40 px-4"
          />
        </label>

        <label className="block text-sm font-medium text-foreground">
          Senha temporária
          <Input
            type="password"
            name="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            minLength={10}
            maxLength={128}
            required
            placeholder="••••••••••"
            className="mt-1.5 h-11 rounded-xl bg-muted/40 px-4"
          />
          <span className="mt-1.5 block text-xs font-normal text-muted-foreground">
            Use maiúscula, minúscula, número e símbolo.
          </span>
        </label>

        <label className="block text-sm font-medium text-foreground">
          Cargo
          <select
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            className="mt-1.5 h-11 w-full rounded-xl border border-input bg-muted/40 px-4 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="USER">Usuário comum</option>
            <option value="ADMIN">Administrador</option>
          </select>
          <span className="mt-1.5 block text-xs font-normal text-muted-foreground">
            Administradores podem cadastrar outros usuários.
          </span>
        </label>
      </div>

      <div className="flex justify-end border-t border-border pt-5">
        <Button type="submit" disabled={pending} className="h-11 px-5 shadow-sm">
          <UserPlus size={17} aria-hidden="true" />
          {pending ? "Criando usuário..." : "Criar usuário"}
        </Button>
      </div>
    </form>
  );
}
