/**
 * La facturación de un cliente, vista por él mismo.
 *
 * Aquí está la frontera de datos de «Mi facturación», escrita una sola vez:
 *
 *   · Solo los cobros de **sus empresas**.
 *   · Solo lo **ya facturado**. Lo que sigue en Backlog o Por facturar es
 *     planificación interna: todavía no es una factura que el cliente deba.
 *   · Solo los campos que se le pueden enseñar. Las notas, las etiquetas, quién
 *     lleva el cobro y el hilo de comentarios son del equipo, y por eso el
 *     `select` va aquí cerrado y no en la página.
 */

import { prisma } from "@/lib/prisma";
import type { BillingStatus } from "@/generated/prisma";
import { INVOICED_STATUSES, isClosed, pendiente } from "@/lib/billing/status";
import { pasarelaLista, urlDePago } from "@/lib/billing/paylink";

/** Los únicos estados en los que el cliente encuentra su link de pago. */
const CON_LINK: BillingStatus[] = ["FACTURADO", "ABONADO"];

export type EstadoFactura = "PENDIENTE" | "ABONADA" | "PAGADA";

export type FacturaDeCliente = {
  id: string;
  concept: string;
  company: string;
  invoiceNumber: string | null;
  invoicedAt: Date | null;
  invoiceDueDate: Date | null;
  paidAt: Date | null;
  total: number;
  pagado: number;
  falta: number;
  estado: EstadoFactura;
  vencida: boolean;
  /** Dirección de la página de pago en línea, si hay link y aún se puede pagar. */
  linkPago: string | null;
  abonos: { amount: number; paidOn: Date; method: string | null }[];
};

export async function facturasDeCliente(userId: string, hoy = new Date()): Promise<FacturaDeCliente[]> {
  const usuario = await prisma.user.findUnique({
    where: { id: userId },
    select: { companies: { select: { id: true } } },
  });
  const companyIds = (usuario?.companies ?? []).map((c) => c.id);
  if (companyIds.length === 0) return [];

  const cobros = await prisma.billingItem.findMany({
    where: { companyId: { in: companyIds }, status: { in: INVOICED_STATUSES } },
    orderBy: [{ invoicedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true, concept: true, status: true, amount: true, paidAmount: true,
      invoiceNumber: true, invoicedAt: true, invoiceDueDate: true, paidAt: true, payToken: true,
      company: { select: { name: true } },
      payments: {
        orderBy: { paidOn: "desc" },
        select: { amount: true, paidOn: true, method: true },
      },
    },
  });

  const conPasarela = pasarelaLista();

  return cobros.map((c) => {
    const falta = pendiente(c.amount, c.paidAmount);
    // Archivado es un estado del trabajo del equipo, no del dinero: para el
    // cliente una factura archivada es, sencillamente, una pagada.
    const estado: EstadoFactura = isClosed(c.status) ? "PAGADA" : c.paidAmount > 0 ? "ABONADA" : "PENDIENTE";
    const pagable = CON_LINK.includes(c.status) && falta > 0;
    return {
      id: c.id,
      concept: c.concept,
      company: c.company.name,
      invoiceNumber: c.invoiceNumber,
      invoicedAt: c.invoicedAt,
      invoiceDueDate: c.invoiceDueDate,
      paidAt: c.paidAt,
      total: c.amount,
      pagado: c.paidAmount,
      falta,
      estado,
      vencida: estado !== "PAGADA" && c.invoiceDueDate !== null && c.invoiceDueDate < hoy,
      // Solo el link que el equipo ya generó: aquí no se crea ninguno.
      linkPago: pagable && c.payToken && conPasarela ? urlDePago(c.payToken) : null,
      abonos: c.payments,
    };
  });
}
