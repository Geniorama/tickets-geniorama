import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { DOC_TYPES, DOC_TYPE_LABELS } from "@/lib/billing/doc-type";
import { formatAmount } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/format-date";

export const metadata = { title: "Cementerio de anuladas" };

const control: React.CSSProperties = {
  fontSize: "0.8125rem", padding: "0.45rem 0.75rem", borderRadius: "0.5rem",
  border: "1px solid var(--app-border)", backgroundColor: "var(--app-card-bg)",
  color: "var(--app-body-text)",
};

/**
 * Todo lo que se anuló, de lo más reciente a lo más antiguo. Solo se consulta:
 * un documento anulado no revive.
 */
export default async function CementerioPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; q?: string }>;
}) {
  await requireCan("FACTURACION", "ver");
  const { tipo, q } = await searchParams;
  const docType = DOC_TYPES.find((t) => t === tipo);
  const busqueda = q?.trim() ?? "";

  const where: Prisma.BillingVoidWhereInput = {
    ...(docType ? { docType } : {}),
    ...(busqueda
      ? {
          OR: (["invoiceNumber", "companyName", "concept", "reason"] as const).map((campo) => ({
            [campo]: { contains: busqueda, mode: "insensitive" as const },
          })),
        }
      : {}),
  };

  const [anulados, resumen] = await Promise.all([
    prisma.billingVoid.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.billingVoid.aggregate({ where, _count: { _all: true }, _sum: { amount: true } }),
  ]);
  const total = resumen._count._all;
  const filtrando = Boolean(docType || busqueda);

  return (
    <div>
      <Link
        href="/facturacion"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", color: "var(--app-text-muted)", textDecoration: "none", marginBottom: "1rem" }}
      >
        <ArrowLeft style={{ width: "1rem", height: "1rem" }} />
        Volver
      </Link>

      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
        Cementerio de anuladas
      </h1>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
        {total === 0
          ? filtrando ? "Nada coincide con el filtro." : "Todavía no se ha anulado ningún documento."
          : `${total} ${total === 1 ? "documento anulado" : "documentos anulados"} · ${formatAmount(resumen._sum.amount ?? 0)}`}
      </p>

      <form method="get" style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", margin: "1.25rem 0" }}>
        <input
          type="search"
          name="q"
          defaultValue={busqueda}
          placeholder="Número, empresa, concepto o motivo"
          aria-label="Buscar en el cementerio"
          style={{ ...control, minWidth: "17rem" }}
        />
        <select name="tipo" defaultValue={docType ?? ""} aria-label="Tipo de documento" style={control}>
          <option value="">Todos los documentos</option>
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <button type="submit" style={{ ...control, cursor: "pointer" }}>Filtrar</button>
        {filtrando && (
          <Link href="/facturacion/cementerio" style={{ alignSelf: "center", fontSize: "0.8125rem", color: "#fd1384", textDecoration: "none" }}>
            Quitar filtros
          </Link>
        )}
      </form>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxWidth: "52rem" }}>
        {anulados.map((v) => (
          <article
            key={v.id}
            style={{
              backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
              borderRadius: "0.75rem", padding: "1rem 1.15rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem 1rem" }}>
              <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "var(--app-body-text)" }}>
                {DOC_TYPE_LABELS[v.docType]} {v.invoiceNumber ?? "sin número"}
              </p>
              <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 700, color: "var(--app-text-muted)", textDecoration: "line-through", fontVariantNumeric: "tabular-nums" }}>
                {formatAmount(v.amount)}
              </p>
            </div>
            <p style={{ margin: "0.2rem 0 0", fontSize: "0.8125rem", color: "var(--app-nav-text)" }}>
              {v.companyName} · {v.concept}
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", color: "var(--app-body-text)", whiteSpace: "pre-wrap" }}>
              {v.reason}
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
              {[
                v.invoicedAt ? `Emitida el ${formatDate(v.invoicedAt)}` : null,
                `Anulada el ${formatDateTime(v.createdAt)} por ${v.voidedByName}`,
                v.reissue ? "El cobro volvió a «Por facturar»" : "Cobro dado de baja",
              ].filter(Boolean).join(" · ")}
              {" · "}
              {v.billingItemId ? (
                <Link href={`/facturacion/${v.billingItemId}`} style={{ color: "#fd1384", textDecoration: "none" }}>
                  Ver cobro
                </Link>
              ) : (
                "El cobro se eliminó"
              )}
            </p>
          </article>
        ))}
        {total > anulados.length && (
          <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>
            Se muestran los {anulados.length} más recientes. Usa el buscador para llegar a los demás.
          </p>
        )}
      </div>
    </div>
  );
}
