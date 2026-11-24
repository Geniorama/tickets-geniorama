"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import { parseAmount } from "@/lib/money";
import type { ExpenseKind } from "@/generated/prisma";

/** Libro de costos del tablero gerencial. Pide GESTOR: son cifras internas. */

const KINDS: ExpenseKind[] = ["PERSONAL", "PROVEEDOR", "OPERACION"];

export async function createExpense(input: {
  concept: string; kind: string; amount: string; incurredOn: string; supplier?: string;
}) {
  const session = await requireCan("FACTURACION", "gestionar");

  const concept = input.concept.trim().slice(0, 200);
  const amount = parseAmount(input.amount);
  const fecha = new Date(`${input.incurredOn}T12:00:00`);
  if (!concept) return { error: "Escribe el concepto del costo" };
  if (!KINDS.includes(input.kind as ExpenseKind)) return { error: "Tipo de costo no válido" };
  if (amount === null || amount <= 0) return { error: "El importe debe ser mayor que cero" };
  if (Number.isNaN(fecha.getTime())) return { error: "Fecha no válida" };

  await prisma.expense.create({
    data: {
      concept, kind: input.kind as ExpenseKind, amount, incurredOn: fecha,
      supplier: input.supplier?.trim().slice(0, 120) || null,
      createdById: session.user.id,
    },
  });

  revalidatePath("/gerencial", "layout");
  return { success: true };
}

export async function deleteExpense(id: string) {
  await requireCan("FACTURACION", "gestionar");
  // Los costos que vienen de la nómina se manejan desde la nómina.
  const deNomina = await prisma.payrollEntry.findUnique({ where: { expenseId: id }, select: { id: true } });
  if (deNomina) return { error: "Este costo viene de la nómina; quítalo desde allí" };
  const { count } = await prisma.expense.deleteMany({ where: { id } });
  if (count === 0) return { error: "Costo no encontrado" };
  revalidatePath("/gerencial", "layout");
  return { success: true };
}
