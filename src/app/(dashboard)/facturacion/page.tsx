import Link from "next/link";
import { Plus, Bell, PieChart } from "lucide-react";
import { requireCan, can } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { BILLING_STATUSES, OPEN_BILLING_STATUSES, pendiente } from "@/lib/billing/status";
import { formatAmount } from "@/lib/money";
import { BillingBoard, type BoardItem } from "@/components/billing/billing-board";

export const metadata = { title: "Facturación" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ pagados?: string }>;
}) {
  const session = await requireCan("FACTURACION", "ver");
  const canEdit = await can(session.user, "FACTURACION", "editar");
  const canManage = await can(session.user, "FACTURACION", "gestionar");
  const { pagados } = await searchParams;

  // Lo pagado se acumula sin límite y en unos meses taparía lo que falta por
  // cobrar, que es para lo que se mira este tablero. Mismo criterio que las
  // oportunidades cerradas del CRM.
  const verPagados = pagados === "1";
  const statuses = verPagados ? BILLING_STATUSES : OPEN_BILLING_STATUSES;

  const [items, pagadosOcultos] = await Promise.all([
    prisma.billingItem.findMany({
      where: { status: { in: statuses } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true, concept: true, status: true, amount: true, paidAmount: true,
        dueDate: true, invoiceNumber: true,
        company: { select: { id: true, name: true } },
        owner: { select: { name: true } },
        labels: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.billingItem.count({ where: { status: "PAGADO" } }),
  ]);

  // Novedades y soportes viven en las tablas compartidas: dos consultas
  // agrupadas en vez de una por tarjeta.
  const ids = items.map((i) => i.id);
  const [porComentarios, porAdjuntos] = await Promise.all([
    prisma.comment.groupBy({
      by: ["entityId"],
      where: { entityType: "BILLING", entityId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.attachment.groupBy({
      by: ["entityId"],
      where: { entityType: "BILLING", entityId: { in: ids } },
      _count: { _all: true },
    }),
  ]);
  const novedades = new Map<string, number>();
  for (const g of [...porComentarios, ...porAdjuntos]) {
    novedades.set(g.entityId, (novedades.get(g.entityId) ?? 0) + g._count._all);
  }

  const conNovedades = items.map((i) => ({ ...i, notes: novedades.get(i.id) ?? 0 }));

  const abiertos = items.filter((i) => i.status !== "PAGADO");
  // La cifra que importa: lo que falta por entrar, no lo facturado.
  const porCobrar = abiertos.reduce((s, i) => s + pendiente(i.amount, i.paidAmount), 0);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Facturación
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
            {abiertos.length === 0
              ? "Nada pendiente de cobrar."
              : `${abiertos.length} ${abiertos.length === 1 ? "cobro pendiente" : "cobros pendientes"}${
                  porCobrar > 0 ? ` · ${formatAmount(porCobrar)} por cobrar` : ""
                }`}
            {!verPagados && pagadosOcultos > 0 && (
              <>
                {" · "}
                <Link href="/facturacion?pagados=1" style={{ color: "#fd1384", textDecoration: "none" }}>
                  {pagadosOcultos} {pagadosOcultos === 1 ? "pagado oculto" : "pagados ocultos"}
                </Link>
              </>
            )}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <Link
            href={verPagados ? "/facturacion" : "/facturacion?pagados=1"}
            style={{
              fontSize: "0.8125rem", padding: "0.45rem 0.85rem", borderRadius: "0.5rem",
              border: "1px solid var(--app-border)", color: "var(--app-nav-text)", textDecoration: "none",
            }}
          >
            {verPagados
              ? "Ocultar pagados"
              : `Ver pagados${pagadosOcultos > 0 ? ` (${pagadosOcultos})` : ""}`}
          </Link>
          <Link
            href="/facturacion/categorias"
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              fontSize: "0.8125rem", padding: "0.45rem 0.85rem", borderRadius: "0.5rem",
              border: "1px solid var(--app-border)", color: "var(--app-nav-text)", textDecoration: "none",
            }}
          >
            <PieChart style={{ width: "0.9rem", height: "0.9rem" }} />
            Qué se vendió
          </Link>
          {canManage && (
            <Link
              href="/facturacion/recordatorios"
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                fontSize: "0.8125rem", padding: "0.45rem 0.85rem", borderRadius: "0.5rem",
                border: "1px solid var(--app-border)", color: "var(--app-nav-text)", textDecoration: "none",
              }}
            >
              <Bell style={{ width: "0.9rem", height: "0.9rem" }} />
              Recordatorios
            </Link>
          )}
          {canEdit && (
            <Link
              href="/facturacion/nuevo"
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                backgroundColor: "#fd1384", color: "#fff", borderRadius: "0.5rem",
                padding: "0.55rem 1rem", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none",
              }}
            >
              <Plus style={{ width: "1rem", height: "1rem" }} />
              Nuevo cobro
            </Link>
          )}
        </div>
      </div>

      <BillingBoard items={conNovedades as BoardItem[]} statuses={statuses} canEdit={canEdit} />
    </div>
  );
}
