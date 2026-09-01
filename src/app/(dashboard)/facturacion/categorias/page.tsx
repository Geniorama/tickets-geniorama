import Link from "next/link";
import { ArrowLeft, Download, AlertTriangle } from "lucide-react";
import { requireCan, can } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/money";
import { formatDate } from "@/lib/format-date";
import { ventasPorCategoria, periodoDesdeParams } from "@/lib/billing/categories";
import { CategoryManager } from "@/components/billing/category-manager";

export const metadata = { title: "Categorías de facturación" };

/** Para el `<input type="date">` y para los enlaces del CSV. */
const comoInput = (d: Date) => d.toISOString().slice(0, 10);

export default async function CategoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const session = await requireCan("FACTURACION", "ver");
  const canManage = await can(session.user, "FACTURACION", "gestionar");
  const { desde, hasta } = await searchParams;

  const periodo = periodoDesdeParams(desde, hasta);

  const [filas, catalogo] = await Promise.all([
    ventasPorCategoria(periodo),
    prisma.billingCategory.findMany({
      orderBy: { position: "asc" },
      select: {
        id: true, name: true, color: true, isActive: true,
        _count: { select: { lines: true } },
      },
    }),
  ]);

  const total = filas.reduce((s, f) => s + f.base, 0);
  const sinCatalogar = filas.find((f) => f.categoryId === null);
  const csv = `/api/facturacion/categorias.csv?desde=${comoInput(periodo.desde)}&hasta=${comoInput(periodo.hasta)}`;

  return (
    <div>
      <Link
        href="/facturacion"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", color: "var(--app-text-muted)", textDecoration: "none", marginBottom: "1rem" }}
      >
        <ArrowLeft style={{ width: "1rem", height: "1rem" }} />
        Volver
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Qué se vendió
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
            Lo facturado entre el {formatDate(periodo.desde)} y el {formatDate(periodo.hasta)},
            repartido por categoría. Sobre la base, sin IVA.
          </p>
        </div>

        <a
          href={csv}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            fontSize: "0.8125rem", padding: "0.45rem 0.85rem", borderRadius: "0.5rem",
            border: "1px solid var(--app-border)", color: "var(--app-nav-text)", textDecoration: "none",
          }}
        >
          <Download style={{ width: "0.9rem", height: "0.9rem" }} />
          Descargar detalle
        </a>
      </div>

      {/* El periodo se elige con un formulario normal: así la URL lleva el
          filtro y se puede compartir o guardar en marcadores. */}
      <form
        method="get"
        style={{ display: "flex", alignItems: "flex-end", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1.5rem" }}
      >
        <div>
          <label htmlFor="desde" style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginBottom: "0.2rem" }}>
            Desde
          </label>
          <input
            id="desde" name="desde" type="date" defaultValue={comoInput(periodo.desde)}
            style={{ padding: "0.45rem 0.6rem", fontSize: "0.8125rem", borderRadius: "0.5rem", border: "1px solid var(--app-border)", backgroundColor: "var(--app-bg)", color: "var(--app-body-text)" }}
          />
        </div>
        <div>
          <label htmlFor="hasta" style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginBottom: "0.2rem" }}>
            Hasta
          </label>
          <input
            id="hasta" name="hasta" type="date" defaultValue={comoInput(periodo.hasta)}
            style={{ padding: "0.45rem 0.6rem", fontSize: "0.8125rem", borderRadius: "0.5rem", border: "1px solid var(--app-border)", backgroundColor: "var(--app-bg)", color: "var(--app-body-text)" }}
          />
        </div>
        <button
          type="submit"
          style={{ padding: "0.45rem 0.9rem", fontSize: "0.8125rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#fd1384", color: "#fff", cursor: "pointer" }}
        >
          Ver
        </button>
      </form>

      {filas.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
          No se facturó nada en ese periodo.
        </p>
      ) : (
        <div style={{ maxWidth: "44rem" }}>
          <p style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", fontVariantNumeric: "tabular-nums" }}>
            {formatAmount(total)}
          </p>
          <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginBottom: "1rem" }}>
            facturado en el periodo
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
            {filas.map((f) => (
              <div key={f.categoryId ?? "sin"}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", marginBottom: "0.25rem" }}>
                  <span style={{ fontSize: "0.875rem", color: f.categoryId ? "var(--app-body-text)" : "#b45309", fontWeight: 500 }}>
                    {f.nombre}
                    <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", fontWeight: 400 }}>
                      {" "}· {f.lineas} {f.lineas === 1 ? "línea" : "líneas"}
                    </span>
                  </span>
                  <span style={{ fontSize: "0.875rem", color: "var(--app-body-text)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                    {formatAmount(f.base)}
                    <span style={{ color: "var(--app-text-muted)", fontSize: "0.75rem" }}> · {f.porcentaje.toFixed(0)}%</span>
                  </span>
                </div>
                {/* La barra dice de un vistazo lo que la cifra dice exacto. */}
                <div style={{ height: "0.35rem", borderRadius: "9999px", backgroundColor: "var(--app-border)", overflow: "hidden" }}>
                  <div style={{ width: `${f.porcentaje}%`, height: "100%", backgroundColor: f.color }} />
                </div>
              </div>
            ))}
          </div>

          {sinCatalogar && (
            <div
              style={{
                display: "flex", gap: "0.6rem", alignItems: "flex-start", marginTop: "1.25rem",
                backgroundColor: "#f59e0b14", border: "1px solid #f59e0b55",
                borderRadius: "0.75rem", padding: "0.85rem 1rem",
              }}
            >
              <AlertTriangle style={{ width: "1rem", height: "1rem", color: "#f59e0b", flexShrink: 0, marginTop: "0.15rem" }} />
              <p style={{ fontSize: "0.8125rem", color: "var(--app-nav-text)", margin: 0, lineHeight: 1.55 }}>
                {formatAmount(sinCatalogar.base)} sin categoría, en {sinCatalogar.lineas}{" "}
                {sinCatalogar.lineas === 1 ? "línea" : "líneas"}. Son cobros anteriores a las
                categorías o que se guardaron sin elegir una; hasta que se catalogen, contabilidad
                no puede repartirlos.
              </p>
            </div>
          )}
        </div>
      )}

      <div style={{ maxWidth: "44rem", marginTop: "2.5rem" }}>
        <CategoryManager categorias={catalogo} canManage={canManage} />
      </div>
    </div>
  );
}
