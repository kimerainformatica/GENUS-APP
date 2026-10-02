"use client";

import { useState, useTransition, type ReactNode } from "react";
import { KeyRound, ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";
import { alterarCargoUsuario, alterarStatusUsuario, redefinirSenhaUsuario, type UsuarioActionResult } from "@/lib/actions/usuarios";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = { id: string; nome: string; role: "ADMIN" | "USER"; ativo: boolean };

function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel,
  danger,
  run,
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => Promise<UsuarioActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError("");
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {error && <p role="alert" className="mt-3 text-xs font-medium text-destructive">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <DialogClose className={buttonVariants({ variant: "ghost" })}>Cancelar</DialogClose>
          <Button
            type="button"
            disabled={pending}
            className={danger ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            onClick={() =>
              startTransition(async () => {
                const result = await run();
                if (!result.success) return setError(result.error);
                setOpen(false);
              })
            }
          >
            {pending ? "Salvando…" : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ id, nome }: { id: string; nome: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError("");
    startTransition(async () => {
      const result = await redefinirSenhaUsuario(id, formData);
      if (!result.success) return setError(result.error);
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError("");
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <KeyRound size={14} aria-hidden="true" />
        Redefinir senha
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Redefinir senha de {nome}</DialogTitle>
        <DialogDescription>
          Defina uma senha temporária e passe para o usuário. No próximo acesso ele será obrigado a criar a própria senha. Os acessos abertos dele serão encerrados.
        </DialogDescription>
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Senha temporária</span>
            <Input type="password" name="senhaTemporaria" autoComplete="new-password" minLength={10} maxLength={128} required />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-foreground">Confirmar senha temporária</span>
            <Input type="password" name="confirmacao" autoComplete="new-password" minLength={10} maxLength={128} required />
          </label>
          <p className="text-xs text-muted-foreground">Mínimo de 10 caracteres, com maiúscula, minúscula, número e símbolo.</p>
          {error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <DialogClose className={buttonVariants({ variant: "ghost" })}>Cancelar</DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Redefinir senha"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UserRowActions({ id, nome, role, ativo }: Props) {
  const isAdmin = role === "ADMIN";
  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <ResetPasswordDialog id={id} nome={nome} />
      <ConfirmAction
        trigger={
          <Button variant="outline" size="sm">
            {isAdmin ? <ShieldOff size={14} aria-hidden="true" /> : <ShieldCheck size={14} aria-hidden="true" />}
            {isAdmin ? "Tornar usuário comum" : "Tornar administrador"}
          </Button>
        }
        title={isAdmin ? `Remover ${nome} dos administradores?` : `Tornar ${nome} administrador?`}
        description={
          isAdmin
            ? "Ele deixa de poder gerenciar usuários e o código de recuperação dele é descartado."
            : "Ele passa a poder criar usuários, redefinir senhas e alterar cargos. No primeiro acesso como administrador, deverá gerar o próprio código de recuperação."
        }
        confirmLabel={isAdmin ? "Tornar usuário comum" : "Tornar administrador"}
        run={() => alterarCargoUsuario(id, isAdmin ? "USER" : "ADMIN")}
      />
      <ConfirmAction
        trigger={
          <Button variant="outline" size="sm" className={ativo ? "text-destructive" : undefined}>
            {ativo ? <UserX size={14} aria-hidden="true" /> : <UserCheck size={14} aria-hidden="true" />}
            {ativo ? "Desativar" : "Reativar"}
          </Button>
        }
        title={ativo ? `Desativar ${nome}?` : `Reativar ${nome}?`}
        description={
          ativo
            ? "Ele não consegue mais entrar no app e os acessos abertos dele são encerrados. Os dados que ele cadastrou continuam no app. Dá para reativar depois."
            : "Ele volta a conseguir entrar no app com a senha que já tinha."
        }
        confirmLabel={ativo ? "Desativar" : "Reativar"}
        danger={ativo}
        run={() => alterarStatusUsuario(id, !ativo)}
      />
    </div>
  );
}
