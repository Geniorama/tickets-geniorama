"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";

/**
 * El catálogo de categorías.
 *
 * Pide GESTOR: cambiar cómo se cataloga lo vendido afecta a todos los informes
 * que mire contabilidad, no a un cobro.
 */

export async function createBillingCategory(name: string, color: string) {
  await requireCan("FACTURACION", "gestionar");

  const limpio = name.trim().slice(0, 60);
  if (!limpio) return { error: "La categoría necesita un nombre" };

  // Devolver la que existe en vez de fallar: dos personas creando «Hosting» a
  // la vez es normal, y no es un error que haya que resolver.
  const ya = await prisma.billingCategory.findUnique({ where: { name: limpio }, select: { id: true } });
  if (ya) return { success: true, id: ya.id };

  const ultima = await prisma.billingCategory.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const creada = await prisma.billingCategory.create({
    data: { name: limpio, color, position: (ultima?.position ?? -1) + 1 },
    select: { id: true },
  });

  revalidatePath("/facturacion/categorias");
  return { success: true, id: creada.id };
}

export async function renameBillingCategory(id: string, name: string) {
  await requireCan("FACTURACION", "gestionar");

  const limpio = name.trim().slice(0, 60);
  if (!limpio) return { error: "La categoría necesita un nombre" };

  const otra = await prisma.billingCategory.findFirst({
    where: { name: limpio, NOT: { id } },
    select: { id: true },
  });
  if (otra) return { error: `Ya existe una categoría llamada «${limpio}»` };

  const { count } = await prisma.billingCategory.updateMany({ where: { id }, data: { name: limpio } });
  if (count === 0) return { error: "Categoría no encontrada" };

  revalidatePath("/facturacion/categorias");
  return { success: true };
}

/**
 * Retira o repone una categoría.
 *
 * No se borra: los cobros que ya la llevan seguirían apareciendo como «sin
 * categoría» y un informe cerrado cambiaría de cifras meses después. Retirar
 * solo la quita del desplegable.
 */
export async function toggleBillingCategory(id: string, activa: boolean) {
  await requireCan("FACTURACION", "gestionar");

  const { count } = await prisma.billingCategory.updateMany({ where: { id }, data: { isActive: activa } });
  if (count === 0) return { error: "Categoría no encontrada" };

  revalidatePath("/facturacion/categorias");
  return { success: true };
}
