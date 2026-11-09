/**
 * Kit de skeletons para los `loading.tsx`.
 *
 * Un skeleton es el esqueleto de la pantalla mientras llegan los datos: mismas
 * cajas, mismas proporciones, sin contenido. Se ve igual en tema claro y oscuro
 * (colores en `--skeleton-*`, definidos en globals.css) y respeta
 * `prefers-reduced-motion`.
 *
 * Son componentes de servidor, sin estado: se pueden usar directo en un
 * `loading.tsx` o como `fallback` de un <Suspense>.
 *
 *   export default function Loading() {
 *     return <ListPageSkeleton filters={4} />;
 *   }
 */

import type { CSSProperties } from "react";

/* ── Pieza base ────────────────────────────────────────────────────────── */

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div aria-hidden="true" className={`skeleton ${className}`} style={style} />;
}

/** Líneas de texto; la última es más corta, como en un párrafo real. */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          style={{ height: "0.75rem", width: i === lines - 1 && lines > 1 ? "60%" : "100%" }}
        />
      ))}
    </div>
  );
}

/** Contenedor con el aspecto de una tarjeta de la app. */
export function SkeletonCard({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{
        background: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Región accesible: lectores de pantalla anuncian "cargando" una sola vez. */
function Region({ children, label = "Cargando contenido" }: { children: React.ReactNode; label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/* ── Bloques de página ─────────────────────────────────────────────────── */

/** Título + botón de acción, como la cabecera de cada módulo. */
export function PageHeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <Skeleton style={{ height: "2rem", width: "11rem" }} />
      {action && <Skeleton style={{ height: "2.25rem", width: "8.5rem", borderRadius: "0.5rem" }} />}
    </div>
  );
}

/** Búsqueda + orden y, debajo, la cuadrícula de filtros (misma geometría que FilterBar). */
export function FilterBarSkeleton({ filters = 4 }: { filters?: number }) {
  return (
    <div className="flex flex-col gap-3 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton style={{ height: "2.25rem", flex: "1 1 16rem", maxWidth: "24rem", borderRadius: "0.5rem" }} />
        <Skeleton style={{ height: "2.25rem", width: "13rem", marginLeft: "auto", borderRadius: "0.5rem" }} />
      </div>
      {filters > 0 && (
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(11.5rem, 1fr))",
          }}
        >
          {Array.from({ length: filters }).map((_, i) => (
            <div key={i}>
              <Skeleton style={{ height: "0.625rem", width: "4rem", marginBottom: "0.375rem" }} />
              <Skeleton style={{ height: "2.25rem", borderRadius: "0.5rem" }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Tabla: fila de cabecera + filas con anchos variados para que no parezca una rejilla. */
export function TableSkeleton({ rows = 8, columns = 5 }: { rows?: number; columns?: number }) {
  const widths = ["55%", "80%", "40%", "65%", "30%", "70%"];
  const template = `2.2fr ${"1fr ".repeat(Math.max(columns - 1, 1)).trim()}`;
  return (
    <SkeletonCard className="overflow-hidden">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: template,
          gap: "1rem",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--app-border)",
        }}
      >
        {Array.from({ length: columns }).map((_, c) => (
          <Skeleton key={c} style={{ height: "0.625rem", width: c === 0 ? "30%" : "50%" }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: "grid",
            gridTemplateColumns: template,
            gap: "1rem",
            alignItems: "center",
            padding: "0.875rem 1rem",
            borderBottom: r === rows - 1 ? "none" : "1px solid var(--app-border)",
          }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              style={{
                height: c === 0 ? "0.875rem" : "1.25rem",
                width: c === 0 ? widths[(r + c) % widths.length] : c === 1 ? "5rem" : widths[(r + c) % widths.length],
                borderRadius: c === 0 ? "0.25rem" : "9999px",
              }}
            />
          ))}
        </div>
      ))}
    </SkeletonCard>
  );
}

/** Tarjetas de indicadores (KPIs). */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className="p-4">
          <Skeleton style={{ height: "0.625rem", width: "50%", marginBottom: "0.75rem" }} />
          <Skeleton style={{ height: "1.75rem", width: "40%", marginBottom: "0.5rem" }} />
          <Skeleton style={{ height: "0.625rem", width: "65%" }} />
        </SkeletonCard>
      ))}
    </div>
  );
}

/** Rejilla de tarjetas (proyectos, servicios, bóveda…). */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton style={{ height: "2.25rem", width: "2.25rem", borderRadius: "0.5rem", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Skeleton style={{ height: "0.875rem", width: "70%", marginBottom: "0.375rem" }} />
              <Skeleton style={{ height: "0.625rem", width: "40%" }} />
            </div>
          </div>
          <SkeletonText lines={2} />
          <div className="flex gap-2 mt-4">
            <Skeleton style={{ height: "1.25rem", width: "4.5rem", borderRadius: "9999px" }} />
            <Skeleton style={{ height: "1.25rem", width: "3.5rem", borderRadius: "9999px" }} />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

/** Tablero por columnas (tickets kanban, facturación, oportunidades). */
export function KanbanSkeleton({ columns = 5, cards = 3 }: { columns?: number; cards?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 items-start">
      {Array.from({ length: columns }).map((_, c) => (
        <SkeletonCard key={c} className="overflow-hidden">
          <div
            className="flex items-center justify-between"
            style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--app-border)" }}
          >
            <Skeleton style={{ height: "0.875rem", width: "5.5rem" }} />
            <Skeleton style={{ height: "1.25rem", width: "1.75rem", borderRadius: "9999px" }} />
          </div>
          <div className="flex flex-col gap-2 p-3">
            {Array.from({ length: Math.max(cards - (c % 3), 1) }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg p-3"
                style={{ border: "1px solid var(--app-border)" }}
              >
                <Skeleton style={{ height: "0.875rem", width: "85%", marginBottom: "0.5rem" }} />
                <Skeleton style={{ height: "0.625rem", width: "55%", marginBottom: "0.75rem" }} />
                <Skeleton style={{ height: "1.25rem", width: "4rem", borderRadius: "9999px" }} />
              </div>
            ))}
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

/** Formulario: etiquetas + campos. */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <SkeletonCard className="p-6" style={{ maxWidth: "42rem" }}>
      <div className="space-y-5">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i}>
            <Skeleton style={{ height: "0.75rem", width: "6rem", marginBottom: "0.5rem" }} />
            <Skeleton style={{ height: i === fields - 1 ? "6rem" : "2.5rem", borderRadius: "0.5rem" }} />
          </div>
        ))}
        <div className="flex gap-3 pt-2">
          <Skeleton style={{ height: "2.25rem", width: "7rem", borderRadius: "0.5rem" }} />
          <Skeleton style={{ height: "2.25rem", width: "5.5rem", borderRadius: "0.5rem" }} />
        </div>
      </div>
    </SkeletonCard>
  );
}

/** Detalle: título + metadatos a la izquierda, panel lateral a la derecha. */
export function DetailSkeleton() {
  return (
    <div>
      <div className="mb-6">
        <Skeleton style={{ height: "0.75rem", width: "7rem", marginBottom: "0.75rem" }} />
        <Skeleton style={{ height: "2rem", width: "55%", marginBottom: "0.75rem" }} />
        <div className="flex gap-2">
          <Skeleton style={{ height: "1.5rem", width: "5.5rem", borderRadius: "0.25rem" }} />
          <Skeleton style={{ height: "1.5rem", width: "4.5rem", borderRadius: "0.25rem" }} />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <SkeletonCard className="p-5">
            <SkeletonText lines={5} />
          </SkeletonCard>
          <SkeletonCard className="p-5">
            <Skeleton style={{ height: "0.875rem", width: "8rem", marginBottom: "1rem" }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 mb-4 last:mb-0">
                <Skeleton style={{ height: "2rem", width: "2rem", borderRadius: "9999px", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <Skeleton style={{ height: "0.625rem", width: "30%", marginBottom: "0.5rem" }} />
                  <SkeletonText lines={2} />
                </div>
              </div>
            ))}
          </SkeletonCard>
        </div>
        <SkeletonCard className="p-5 self-start">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="mb-4 last:mb-0">
              <Skeleton style={{ height: "0.625rem", width: "35%", marginBottom: "0.375rem" }} />
              <Skeleton style={{ height: "0.875rem", width: i % 2 ? "70%" : "50%" }} />
            </div>
          ))}
        </SkeletonCard>
      </div>
    </div>
  );
}

/* ── Páginas completas (lo que exportan los loading.tsx) ───────────────── */

export function ListPageSkeleton({
  filters = 4,
  rows = 8,
  columns = 5,
  action = true,
}: {
  filters?: number;
  rows?: number;
  columns?: number;
  action?: boolean;
}) {
  return (
    <Region>
      <PageHeaderSkeleton action={action} />
      <FilterBarSkeleton filters={filters} />
      <TableSkeleton rows={rows} columns={columns} />
    </Region>
  );
}

export function CardsPageSkeleton({ filters = 3, count = 6 }: { filters?: number; count?: number }) {
  return (
    <Region>
      <PageHeaderSkeleton />
      <FilterBarSkeleton filters={filters} />
      <CardGridSkeleton count={count} />
    </Region>
  );
}

export function BoardPageSkeleton({ filters = 3 }: { filters?: number }) {
  return (
    <Region>
      <PageHeaderSkeleton />
      <FilterBarSkeleton filters={filters} />
      <KanbanSkeleton />
    </Region>
  );
}

export function DashboardPageSkeleton() {
  return (
    <Region>
      <PageHeaderSkeleton action={false} />
      <StatCardsSkeleton />
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonCard key={i} className="p-5">
            <Skeleton style={{ height: "0.875rem", width: "9rem", marginBottom: "1.25rem" }} />
            <Skeleton style={{ height: "12rem", borderRadius: "0.5rem" }} />
          </SkeletonCard>
        ))}
      </div>
    </Region>
  );
}

export function FormPageSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <Region>
      <PageHeaderSkeleton action={false} />
      <FormSkeleton fields={fields} />
    </Region>
  );
}

export function DetailPageSkeleton() {
  return (
    <Region>
      <DetailSkeleton />
    </Region>
  );
}
