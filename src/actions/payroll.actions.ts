"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import { parseAmount } from "@/lib/money";

/**
 * Nómina mensual. Cada registro mantiene su propio costo PERSONAL en
 * `expenses`, en la misma transacción, para que el tablero gerencial la sume
 * sin doble captura. Pide GESTOR: son salarios.
 */

function parsePeriodo(raw: string): { inicio: Date; fin: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const y = Number(m[1]), mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return { inicio: new Date(y, mes - 1, 1), fin: new Date(y, mes, 0, 12) };
}

const etiquetaMes = (d: Date) => d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });

function revalidar() {
  revalidatePath("/gerencial", "layout");
}

export async function createPayroll(input: {
  period: string; personName: string; baseSalary: string; extras?: string; contributions?: string; notes?: string;
}) {
  const session = await requireCan("FACTURACION", "gestionar");

  const periodo = parsePeriodo(input.period);
  const personName = input.personName.trim().slice(0, 120);
  const base = parseAmount(input.baseSalary);
  const extras = parseAmount(input.extras) ?? 0;
  const aportes = parseAmount(input.contributions) ?? 0;
  if (!periodo) return { error: "Mes no válido" };
  if (!personName) return { error: "Escribe el nombre de la persona" };
  if (base === null || base <= 0) return { error: "El salario base debe ser mayor que cero" };
  if (extras < 0 || aportes < 0) return { error: "Los importes no pueden ser negativos" };

  const ya = await prisma.payrollEntry.findFirst({
    where: { period: periodo.inicio, personName: { equals: personName, mode: "insensitive" } },
    select: { id: true },
  });
  if (ya) return { error: `${personName} ya tiene nómina en ${etiquetaMes(periodo.inicio)}` };

  const total = base + extras + aportes;
  await prisma.$transaction(async (tx) => {
    const costo = await tx.expense.create({
      data: {
        concept: `Nómina — ${personName} (${etiquetaMes(periodo.inicio)})`,
        kind: "PERSONAL", amount: total, incurredOn: periodo.fin, createdById: session.user.id,
      },
    });
    await tx.payrollEntry.create({
      data: {
        personName, period: periodo.inicio, baseSalary: base, extras, contributions: aportes, total,
        notes: input.notes?.trim() || null, expenseId: costo.id, createdById: session.user.id,
      },
    });
  });

  revalidar();
  return { success: true };
}

export async function deletePayroll(id: string) {
  await requireCan("FACTURACION", "gestionar");
  const e = await prisma.payrollEntry.findUnique({ where: { id }, select: { expenseId: true } });
  if (!e) return { error: "Registro no encontrado" };

  await prisma.$transaction(async (tx) => {
    await tx.payrollEntry.delete({ where: { id } });
    if (e.expenseId) await tx.expense.deleteMany({ where: { id: e.expenseId } });
  });

  revalidar();
  return { success: true };
}

/** Repite la nómina del mes anterior (sin pisar a quien ya esté en este mes). */
export async function copyPreviousPayroll(period: string) {
  const session = await requireCan("FACTURACION", "gestionar");
  const periodo = parsePeriodo(period);
  if (!periodo) return { error: "Mes no válido" };

  const anterior = new Date(periodo.inicio.getFullYear(), periodo.inicio.getMonth() - 1, 1);
  const [previos, actuales] = await Promise.all([
    prisma.payrollEntry.findMany({ where: { period: anterior } }),
    prisma.payrollEntry.findMany({ where: { period: periodo.inicio }, select: { personName: true } }),
  ]);
  if (previos.length === 0) return { error: `No hay nómina en ${etiquetaMes(anterior)} para copiar` };

  const existentes = new Set(actuales.map((a) => a.personName.toLowerCase()));
  const nuevos = previos.filter((p) => !existentes.has(p.personName.toLowerCase()));
  if (nuevos.length === 0) return { error: "Todas esas personas ya están en este mes" };

  await prisma.$transaction(async (tx) => {
    for (const p of nuevos) {
      const costo = await tx.expense.create({
        data: {
          concept: `Nómina — ${p.personName} (${etiquetaMes(periodo.inicio)})`,
          kind: "PERSONAL", amount: p.total, incurredOn: periodo.fin, createdById: session.user.id,
        },
      });
      await tx.payrollEntry.create({
        data: {
          personName: p.personName, period: periodo.inicio, baseSalary: p.baseSalary, extras: p.extras,
          contributions: p.contributions, total: p.total, notes: p.notes, expenseId: costo.id, createdById: session.user.id,
        },
      });
    }
  });

  revalidar();
  return { success: true, copiados: nuevos.length };
}
