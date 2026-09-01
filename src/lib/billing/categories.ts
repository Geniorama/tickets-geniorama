import { prisma } from "@/lib/prisma";
import type { BillingStatus } from "@/generated/prisma";
import { INVOICED_STATUSES } from "@/lib/billing/status";

/**
 * Lo vendido por categoría en un periodo.
 *
 * Se agrupa **en la base de datos** y no en memoria: esto crece con cada
 * factura y en dos años son miles de líneas que no tiene sentido traerse para
 * sumarlas aquí.
 *
 * El periodo se mide por la fecha de emisión de la factura (`invoicedAt`) y no
 * por cuándo se creó el cobro: contabilidad cierra por mes de facturación.
 */

export type FilaCategoria = {
  categoryId: string | null;
  nombre: string;
  color: string;
  /** Base facturada, sin IVA. */
  base: number;
  /** Cuántas líneas la componen; sirve para saber si un número es raro. */
  lineas: number;
  porcentaje: number;
};

export type Periodo = { desde: Date; hasta: Date };

export async function ventasPorCategoria(periodo: Periodo): Promise<FilaCategoria[]> {
  // Solo lo emitido: lo que está en backlog o por facturar todavía no se ha
  // vendido, y contarlo inflaría el informe con intenciones.
  const lineas = await prisma.billingLine.groupBy({
    by: ["categoryId"],
    where: {
      billingItem: {
        status: { in: INVOICED_STATUSES as BillingStatus[] },
        invoicedAt: { gte: periodo.desde, lte: periodo.hasta },
      },
    },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const ids = lineas.map((l) => l.categoryId).filter((id): id is string => Boolean(id));
  const catalogo = new Map(
    (await prisma.billingCategory.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, color: true },
    })).map((c) => [c.id, c]),
  );

  const total = lineas.reduce((s, l) => s + (l._sum.amount ?? 0), 0);

  return lineas
    .map((l) => {
      const cat = l.categoryId ? catalogo.get(l.categoryId) : undefined;
      const base = l._sum.amount ?? 0;
      return {
        categoryId: l.categoryId,
        nombre: cat?.name ?? "Sin categoría",
        color: cat?.color ?? "#b45309",
        base,
        lineas: l._count._all,
        porcentaje: total > 0 ? (base / total) * 100 : 0,
      };
    })
    // Lo sin catalogar al final: es trabajo pendiente, no una categoría.
    .sort((a, b) =>
      a.categoryId === null ? 1 : b.categoryId === null ? -1 : b.base - a.base,
    );
}

/** El detalle línea a línea, que es lo que se lleva contabilidad a su hoja. */
export async function lineasDelPeriodo(periodo: Periodo) {
  return prisma.billingLine.findMany({
    where: {
      billingItem: {
        status: { in: INVOICED_STATUSES as BillingStatus[] },
        invoicedAt: { gte: periodo.desde, lte: periodo.hasta },
      },
    },
    orderBy: [{ billingItem: { invoicedAt: "asc" } }, { position: "asc" }],
    select: {
      concept: true, amount: true, taxRate: true,
      category: { select: { name: true } },
      billingItem: {
        select: {
          concept: true, invoiceNumber: true, invoicedAt: true, status: true,
          company: { select: { name: true } },
        },
      },
    },
  });
}

/** El mes corriente, que es el periodo que se mira el 95 % de las veces. */
export function mesDe(fecha: Date): Periodo {
  return {
    desde: new Date(fecha.getFullYear(), fecha.getMonth(), 1, 0, 0, 0, 0),
    hasta: new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

/** Lee `?desde=&hasta=` de la URL; sin ellos, el mes en curso. */
export function periodoDesdeParams(desde?: string, hasta?: string, hoy = new Date()): Periodo {
  const d = desde ? new Date(`${desde}T00:00:00`) : null;
  const h = hasta ? new Date(`${hasta}T23:59:59.999`) : null;
  if (d && h && !Number.isNaN(d.getTime()) && !Number.isNaN(h.getTime()) && d <= h) {
    return { desde: d, hasta: h };
  }
  return mesDe(hoy);
}
