import { prisma } from "@/lib/prisma";
import type { BillingStatus } from "@/generated/prisma";
import { INVOICED_STATUSES } from "@/lib/billing/status";
import type { Periodo } from "@/lib/billing/categories";

/**
 * Ventas de un periodo, sumando facturas y cuentas de cobro.
 *
 * Mismo criterio que «Qué se vendió»: solo lo emitido (`invoicedAt` dentro del
 * periodo), porque lo que sigue en backlog es una intención y no una venta. Se
 * agrupa en la base de datos por empresa y tipo, no en memoria.
 */

export type FilaVentas = {
  companyId: string;
  empresa: string;
  facturas: number;
  cuentasCobro: number;
  total: number;
  cobrado: number;
  porCobrar: number;
  documentos: number;
};

export async function ventasPorEmpresa(periodo: Periodo): Promise<FilaVentas[]> {
  const grupos = await prisma.billingItem.groupBy({
    by: ["companyId", "docType"],
    where: {
      status: { in: INVOICED_STATUSES as BillingStatus[] },
      invoicedAt: { gte: periodo.desde, lte: periodo.hasta },
    },
    _sum: { amount: true, paidAmount: true },
    _count: { _all: true },
  });

  const empresas = new Map(
    (await prisma.company.findMany({
      where: { id: { in: [...new Set(grupos.map((g) => g.companyId))] } },
      select: { id: true, name: true },
    })).map((c) => [c.id, c.name]),
  );

  const filas = new Map<string, FilaVentas>();
  for (const g of grupos) {
    const fila = filas.get(g.companyId) ?? {
      companyId: g.companyId, empresa: empresas.get(g.companyId) ?? "—",
      facturas: 0, cuentasCobro: 0, total: 0, cobrado: 0, porCobrar: 0, documentos: 0,
    };
    const monto = g._sum.amount ?? 0;
    const pagado = g._sum.paidAmount ?? 0;
    if (g.docType === "CUENTA_COBRO") fila.cuentasCobro += monto;
    else fila.facturas += monto;
    fila.total += monto;
    fila.cobrado += pagado;
    fila.porCobrar += Math.max(monto - pagado, 0);
    fila.documentos += g._count._all;
    filas.set(g.companyId, fila);
  }

  return [...filas.values()].sort((a, b) => b.total - a.total);
}

/** Ventas por mes de los últimos `meses`, para ver la tendencia de un vistazo. */
export type FilaMes = { mes: string; facturas: number; cuentasCobro: number };

export async function ventasPorMes(hasta: Date, meses = 6): Promise<FilaMes[]> {
  const desde = new Date(hasta.getFullYear(), hasta.getMonth() - (meses - 1), 1);
  const items = await prisma.billingItem.findMany({
    where: {
      status: { in: INVOICED_STATUSES as BillingStatus[] },
      invoicedAt: { gte: desde, lte: hasta },
    },
    select: { amount: true, docType: true, invoicedAt: true },
  });

  const filas: FilaMes[] = [];
  for (let i = 0; i < meses; i++) {
    const d = new Date(desde.getFullYear(), desde.getMonth() + i, 1);
    filas.push({ mes: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, facturas: 0, cuentasCobro: 0 });
  }
  const porMes = new Map(filas.map((f) => [f.mes, f]));
  for (const it of items) {
    if (!it.invoicedAt) continue;
    const clave = `${it.invoicedAt.getFullYear()}-${String(it.invoicedAt.getMonth() + 1).padStart(2, "0")}`;
    const fila = porMes.get(clave);
    if (!fila) continue;
    if (it.docType === "CUENTA_COBRO") fila.cuentasCobro += it.amount;
    else fila.facturas += it.amount;
  }
  return filas;
}

export type FilaOportunidad = {
  id: string;
  titulo: string;
  empresa: string;
  valor: number | null;
  cobrado: number;
  documentos: number;
};

/**
 * Oportunidades ganadas en el periodo y lo que de verdad se ha cobrado por
 * ellas. Es el cruce pipeline contra caja: una ganada sin ningún cobro
 * vinculado es una venta que aún no se está persiguiendo.
 */
export async function oportunidadesGanadas(periodo: Periodo): Promise<FilaOportunidad[]> {
  const deals = await prisma.deal.findMany({
    where: { stage: "GANADA", closedAt: { gte: periodo.desde, lte: periodo.hasta } },
    orderBy: { closedAt: "desc" },
    select: {
      id: true, title: true, amount: true,
      company: { select: { name: true } },
      billingItems: { where: { status: { not: "ANULADO" } }, select: { amount: true, paidAmount: true } },
    },
  });

  return deals.map((d) => ({
    id: d.id,
    titulo: d.title,
    empresa: d.company.name,
    valor: d.amount,
    cobrado: d.billingItems.reduce((s, b) => s + b.paidAmount, 0),
    documentos: d.billingItems.length,
  }));
}
