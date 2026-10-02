"use server";

import { revalidatePath } from "next/cache";
import { runAction, type ActionResult } from "@/lib/action-result";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/user-facing-error";
import { cpfCnpjField, emailField, margemPercentualField, optionalIdField, textField } from "@/lib/validation";

function isUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function saveCliente(formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const id = optionalIdField(formData.get("id"));
    const data = {
      nome: textField(formData.get("nome"), "Nome", { required: true, max: 160 }) as string,
      cpfCnpj: cpfCnpjField(formData.get("cpfCnpj")),
      email: emailField(formData.get("email")),
      telefone: textField(formData.get("telefone"), "Telefone", { max: 30 }),
      margemPercentual: margemPercentualField(formData.get("margemPercentual")),
    };

    try {
      if (id) {
        const existing = await prisma.cliente.findUnique({ where: { id }, select: { id: true } });
        if (!existing) throw new UserFacingError("Cliente não encontrado.");
        await prisma.cliente.update({ where: { id }, data });
      } else {
        await prisma.cliente.create({ data });
      }
    } catch (error) {
      if (isUniqueError(error)) throw new UserFacingError("Já existe um cliente com este CPF/CNPJ.");
      throw error;
    }

    revalidatePath("/clientes");
    if (id) revalidatePath(`/clientes/${id}`);
    revalidatePath("/extratos");
    revalidatePath("/dashboard");
    return {};
  });
}

export async function deleteCliente(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireSession();
    const safeId = optionalIdField(id);
    if (!safeId) throw new UserFacingError("Cliente inválido.");
    const existing = await prisma.cliente.findUnique({ where: { id: safeId }, select: { id: true } });
    if (!existing) throw new UserFacingError("Cliente não encontrado.");
    await prisma.cliente.delete({ where: { id: safeId } });
    revalidatePath("/clientes");
    revalidatePath("/extratos");
    revalidatePath("/dashboard");
    return {};
  });
}
