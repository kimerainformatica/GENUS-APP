"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { cpfCnpjField, emailField, optionalIdField, textField } from "@/lib/validation";

function isUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function saveCliente(formData: FormData) {
  await requireSession();
  const id = optionalIdField(formData.get("id"));
  const data = {
    nome: textField(formData.get("nome"), "Nome", { required: true, max: 160 }) as string,
    cpfCnpj: cpfCnpjField(formData.get("cpfCnpj")),
    email: emailField(formData.get("email")),
    telefone: textField(formData.get("telefone"), "Telefone", { max: 30 }),
  };

  try {
    if (id) {
      const existing = await prisma.cliente.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw new Error("Cliente não encontrado.");
      await prisma.cliente.update({ where: { id }, data });
    } else {
      await prisma.cliente.create({ data });
    }
  } catch (error) {
    if (isUniqueError(error)) throw new Error("Já existe um cliente com este CPF/CNPJ.");
    throw error;
  }

  revalidatePath("/clientes");
  if (id) revalidatePath(`/clientes/${id}`);
  revalidatePath("/extratos");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteCliente(id: string) {
  await requireSession();
  const safeId = optionalIdField(id);
  if (!safeId) throw new Error("Cliente inválido.");
  const existing = await prisma.cliente.findUnique({ where: { id: safeId }, select: { id: true } });
  if (!existing) throw new Error("Cliente não encontrado.");
  await prisma.cliente.delete({ where: { id: safeId } });
  revalidatePath("/clientes");
  revalidatePath("/extratos");
  revalidatePath("/dashboard");
}
