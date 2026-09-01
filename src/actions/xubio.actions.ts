"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import { crearCliente } from "@/lib/xubio/clientes";

/**
 * La conexión con Xubio.
 *
 * Todo pide GESTOR: esto escribe en la contabilidad de la empresa. Y todo lo
 * que crea allá deja aquí el vínculo, que es lo único que impide duplicar un
 * cliente la próxima vez.
 */

/** Enlaza una empresa de aquí con un cliente que ya existe en Xubio. */
export async function vincularCliente(companyId: string, xubioClientId: string) {
  await requireCan("FACTURACION", "gestionar");

  const limpio = xubioClientId.trim();
  if (!limpio) return { error: "Falta el identificador de Xubio" };

  // Un cliente de Xubio enlazado a dos empresas sería facturarle a nombre de
  // otro. La base lo impide con un índice único; aquí se explica.
  const ocupado = await prisma.company.findFirst({
    where: { xubioClientId: limpio, NOT: { id: companyId } },
    select: { name: true },
  });
  if (ocupado) return { error: `Ese cliente de Xubio ya está enlazado con «${ocupado.name}»` };

  const { count } = await prisma.company.updateMany({
    where: { id: companyId },
    data: { xubioClientId: limpio },
  });
  if (count === 0) return { error: "Empresa no encontrada" };

  revalidatePath("/facturacion/xubio");
  return { success: true };
}

export async function desvincularCliente(companyId: string) {
  await requireCan("FACTURACION", "gestionar");

  await prisma.company.updateMany({ where: { id: companyId }, data: { xubioClientId: null } });

  revalidatePath("/facturacion/xubio");
  return { success: true };
}

/**
 * Da de alta la empresa en Xubio y guarda el vínculo.
 *
 * Se llama desde un botón por empresa, después de enseñar exactamente qué se
 * va a crear: dar de alta clientes en la contabilidad de golpe y a ciegas es
 * como se acaba con veinte fichas duplicadas que alguien tiene que limpiar.
 */
export async function crearEnXubio(companyId: string) {
  await requireCan("FACTURACION", "gestionar");

  const empresa = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, taxId: true, xubioClientId: true },
  });
  if (!empresa) return { error: "Empresa no encontrada" };
  if (empresa.xubioClientId) return { error: "Esta empresa ya está enlazada con Xubio" };

  const r = await crearCliente(empresa);
  if (!r.ok) return { error: r.error, detalle: r.detalle };

  await prisma.company.update({
    where: { id: companyId },
    data: { xubioClientId: r.datos.id },
  });

  revalidatePath("/facturacion/xubio");
  return { success: true, id: r.datos.id };
}
