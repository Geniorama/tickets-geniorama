import { prisma } from "@/lib/prisma";
import type { BillingStatus, DealStage } from "@/generated/prisma";
import { INVOICED_STATUSES } from "@/lib/billing/status";
import { ventasPorCategoria, type Periodo } from "@/lib/billing/categories";
import { ventasPorEmpresa } from "@/lib/billing/sales";

/**
 * Tablero gerencial: las mismas fuentes que Cobros y CRM, resumidas.
 *
 * Criterios (para que las cifras cuadren con el resto de la app):
 *   · Ventas ganadas = oportunidades GANADA cerradas en el periodo.
 *   · Facturación = lo emitido (`invoicedAt` en el periodo), con IVA.
 *   · Recaudo = abonos que entraron (`paidOn` en el periodo).
 *   · Cartera = saldo de facturas emitidas sin pagar, a hoy (no depende del periodo).
 *   · Rentabilidad usa la base sin IVA: el IVA no es ingreso de la agencia.
 */

const ABIERTAS: DealStage[] = ["NUEVA", "CONTACTADA", "PROPUESTA", "NEGOCIACION"];
const POR_COBRAR: BillingStatus[] = ["FACTURADO", "ABONADO"];
const SIN_EMITIR: BillingStatus[] = ["BACKLOG", "POR_FACTURAR"];

/** Probabilidad de cierre por etapa, para la proyección ponderada. */
export const PROBABILIDAD_ETAPA: Record<string, number> = {
  NUEVA: 0.1, CONTACTADA: 0.25, PROPUESTA: 0.5, NEGOCIACION: 0.75,
};

const claveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const suma = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);

export type MesFila = { mes: string; facturado: number; recaudado: number; ventas: number };

function mesesHasta(hasta: Date, n: number) {
  const desde = new Date(hasta.getFullYear(), hasta.getMonth() - (n - 1), 1);
  const filas: MesFila[] = [];
  for (let i = 0; i < n; i++) {
    filas.push({ mes: claveMes(new Date(desde.getFullYear(), desde.getMonth() + i, 1)), facturado: 0, recaudado: 0, ventas: 0 });
  }
  return { desde, filas, porMes: new Map(filas.map((f) => [f.mes, f])) };
}

export async function cargarTableroGerencial(periodo: Periodo) {
  const ahora = new Date();
  const { desde: desdeSerie, filas: serie, porMes } = mesesHasta(periodo.hasta, 6);
  const enPeriodo = { gte: periodo.desde, lte: periodo.hasta };

  const [
    ganadas, perdidas, abiertas, facturadoPeriodo, abonosPeriodo, cartera,
    sinEmitir, anticipos, facturadoSerie, abonosSerie, ganadasSerie, gastos,
    porCategoria, porEmpresa, nomina,
  ] = await Promise.all([
    prisma.deal.findMany({
      where: { stage: "GANADA", closedAt: enPeriodo },
      select: { id: true, amount: true, company: { select: { id: true, name: true } }, owner: { select: { id: true, name: true } } },
    }),
    prisma.deal.count({ where: { stage: "PERDIDA", closedAt: enPeriodo } }),
    prisma.deal.findMany({
      where: { stage: { in: ABIERTAS } },
      select: { stage: true, amount: true, expectedCloseAt: true },
    }),
    prisma.billingItem.aggregate({
      where: { status: { in: INVOICED_STATUSES }, invoicedAt: enPeriodo },
      _sum: { amount: true, subtotal: true },
      _count: { _all: true },
    }),
    prisma.billingPayment.aggregate({ where: { paidOn: enPeriodo }, _sum: { amount: true } }),
    prisma.billingItem.findMany({
      where: { status: { in: POR_COBRAR } },
      select: {
        id: true, concept: true, amount: true, paidAmount: true, invoiceDueDate: true, invoiceNumber: true,
        company: { select: { id: true, name: true } },
      },
    }),
    prisma.billingItem.groupBy({
      by: ["status"],
      where: { status: { in: SIN_EMITIR } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Anticipo: dinero que entró antes de emitir la factura.
    prisma.billingItem.aggregate({
      where: { status: { in: SIN_EMITIR }, paidAmount: { gt: 0 } },
      _sum: { paidAmount: true },
      _count: { _all: true },
    }),
    prisma.billingItem.findMany({
      where: { status: { in: INVOICED_STATUSES }, invoicedAt: { gte: desdeSerie, lte: periodo.hasta } },
      select: { amount: true, invoicedAt: true },
    }),
    prisma.billingPayment.findMany({
      where: { paidOn: { gte: desdeSerie, lte: periodo.hasta } },
      select: { amount: true, paidOn: true },
    }),
    prisma.deal.findMany({
      where: { stage: "GANADA", closedAt: { gte: desdeSerie, lte: periodo.hasta } },
      select: { amount: true, closedAt: true },
    }),
    prisma.expense.groupBy({
      by: ["kind"],
      where: { incurredOn: enPeriodo },
      _sum: { amount: true },
    }),
    ventasPorCategoria(periodo),
    ventasPorEmpresa(periodo),
    prisma.expense.aggregate({ where: { incurredOn: enPeriodo, payroll: { isNot: null } }, _sum: { amount: true }, _count: { _all: true } }),
  ]);

  // ─── Series por mes ────────────────────────────────────────────────────────
  for (const f of facturadoSerie) if (f.invoicedAt) { const m = porMes.get(claveMes(f.invoicedAt)); if (m) m.facturado += f.amount; }
  for (const p of abonosSerie) { const m = porMes.get(claveMes(p.paidOn)); if (m) m.recaudado += p.amount; }
  for (const d of ganadasSerie) if (d.closedAt) { const m = porMes.get(claveMes(d.closedAt)); if (m) m.ventas += d.amount ?? 0; }

  // ─── Cartera ───────────────────────────────────────────────────────────────
  const saldos = cartera
    .map((c) => ({ ...c, saldo: Math.max(c.amount - c.paidAmount, 0), vencida: c.invoiceDueDate !== null && c.invoiceDueDate < ahora }))
    .filter((c) => c.saldo > 0);
  const vencidas = saldos.filter((c) => c.vencida).sort((a, b) => b.saldo - a.saldo);
  const carteraPendiente = suma(saldos, (c) => c.saldo);
  const carteraVencida = suma(vencidas, (c) => c.saldo);

  // ─── Pipeline y proyección ────────────────────────────────────────────────
  const porEtapa = ABIERTAS.map((etapa) => {
    const ds = abiertas.filter((d) => d.stage === etapa);
    return { etapa, cantidad: ds.length, valor: suma(ds, (d) => d.amount ?? 0) };
  });
  const pipelineValor = suma(abiertas, (d) => d.amount ?? 0);
  const pipelinePonderado = suma(abiertas, (d) => (d.amount ?? 0) * (PROBABILIDAD_ETAPA[d.stage] ?? 0));
  const cierraPronto = abiertas.filter(
    (d) => d.expectedCloseAt && d.expectedCloseAt >= ahora && d.expectedCloseAt <= new Date(ahora.getTime() + 30 * 864e5),
  );
  const proyeccion30d = suma(cierraPronto, (d) => (d.amount ?? 0) * (PROBABILIDAD_ETAPA[d.stage] ?? 0));
  const sinFecha = abiertas.filter((d) => !d.expectedCloseAt).length;

  // ─── Comercial ─────────────────────────────────────────────────────────────
  const ventasGanadas = suma(ganadas, (d) => d.amount ?? 0);
  const agrupar = (clave: (d: (typeof ganadas)[number]) => [string, string]) => {
    const m = new Map<string, { nombre: string; valor: number; cantidad: number }>();
    for (const d of ganadas) {
      const [id, nombre] = clave(d);
      const f = m.get(id) ?? { nombre, valor: 0, cantidad: 0 };
      f.valor += d.amount ?? 0; f.cantidad += 1; m.set(id, f);
    }
    return [...m.values()].sort((a, b) => b.valor - a.valor);
  };
  const cerradas = ganadas.length + perdidas;

  // ─── Rentabilidad ──────────────────────────────────────────────────────────
  const costo = (k: string) => gastos.find((g) => g.kind === k)?._sum.amount ?? 0;
  const costoPersonal = costo("PERSONAL");
  const costoProveedores = costo("PROVEEDOR");
  const costoOperacion = costo("OPERACION");
  const ingresosBase = facturadoPeriodo._sum.subtotal ?? 0;
  const margenBruto = ingresosBase - costoPersonal - costoProveedores;
  const utilidadOperativa = margenBruto - costoOperacion;

  return {
    resumen: {
      ventasGanadas, oportunidadesGanadas: ganadas.length,
      facturacionEmitida: facturadoPeriodo._sum.amount ?? 0, documentosEmitidos: facturadoPeriodo._count._all,
      recaudo: abonosPeriodo._sum.amount ?? 0,
      carteraPendiente, carteraVencida,
      pipelineValor, pipelinePonderado, oportunidadesAbiertas: abiertas.length,
    },
    financiero: {
      serie,
      facturacionPendiente: suma(sinEmitir, (s) => s._sum.amount ?? 0),
      porFacturar: sinEmitir.find((s) => s.status === "POR_FACTURAR")?._sum.amount ?? 0,
      backlog: sinEmitir.find((s) => s.status === "BACKLOG")?._sum.amount ?? 0,
      anticipos: anticipos._sum.paidAmount ?? 0, anticiposCobros: anticipos._count._all,
      cobrosPendientes: saldos.length, cobrosVencidos: vencidas.length,
      mayoresVencidos: vencidas.slice(0, 8),
      porEmpresa: porEmpresa.slice(0, 8),
      porCategoria,
    },
    comercial: {
      ganadas: ganadas.length, perdidas,
      conversion: cerradas > 0 ? (ganadas.length / cerradas) * 100 : null,
      promedio: ganadas.length > 0 ? ventasGanadas / ganadas.length : null,
      porCliente: agrupar((d) => [d.company.id, d.company.name]).slice(0, 8),
      porResponsable: agrupar((d) => [d.owner?.id ?? "-", d.owner?.name ?? "Sin responsable"]),
      porEtapa, proyeccion30d, oportunidadesCierranPronto: cierraPronto.length, sinFecha,
    },
    rentabilidad: {
      ingresosBase, porServicio: porCategoria,
      costoPersonal, costoProveedores, costoOperacion,
      costoNomina: nomina._sum.amount ?? 0, personasNomina: nomina._count._all,
      costoTotal: costoPersonal + costoProveedores + costoOperacion,
      margenBruto, margenBrutoPct: ingresosBase > 0 ? (margenBruto / ingresosBase) * 100 : null,
      utilidadOperativa, utilidadPct: ingresosBase > 0 ? (utilidadOperativa / ingresosBase) * 100 : null,
    },
  };
}
