import Link from "next/link";
import { Plus, Building2, UserRound } from "lucide-react";
import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import {
  ACCOUNT_STAGES,
  ACCOUNT_STAGE_COLORS,
  ACCOUNT_STAGE_DESCRIPTIONS,
  ACCOUNT_STAGE_LABELS,
} from "@/lib/crm/accounts";
import { SearchInput } from "@/components/ui/search-input";
import { Suspense } from "react";
import type { AccountStage } from "@/generated/prisma";

export const metadata = { title: "Cuentas" };

export default async function CrmAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireCan("CRM", "ver");
  const params = await searchParams;

  const q = params.q?.trim() || undefined;
  const stageFilter = ACCOUNT_STAGES.includes(params.stage as AccountStage)
    ? (params.stage as AccountStage)
    : undefined;

  const where = {
    isActive: true,
    ...(stageFilter ? { stage: stageFilter } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
  };

  const [accounts, stageCounts] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy: [{ stage: "asc" }, { name: "asc" }],
      take: 100,
      select: {
        id: true,
        name: true,
        stage: true,
        source: true,
        owner: { select: { name: true } },
        _count: { select: { contacts: true, projects: true } },
      },
    }),
    prisma.company.groupBy({
      by: ["stage"],
      where: { isActive: true },
      _count: { _all: true },
    }),
  ]);

  const countByStage = new Map(stageCounts.map((s) => [s.stage, s._count._all]));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 data-tour-id="page-title" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Cuentas
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
            Empresas y prospectos, con su etapa comercial y sus contactos.
          </p>
        </div>
        <Link
          href="/crm/nueva"
          data-tour-id="page-primary-action"
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            backgroundColor: "#fd1384", color: "#fff", padding: "0.5rem 1rem",
            borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none",
          }}
        >
          <Plus style={{ width: "1rem", height: "1rem" }} />
          Nueva cuenta
        </Link>
      </div>

      {/* Etapas del ciclo de vida, con su recuento */}
      <div data-tour-id="page-filters" className="flex flex-wrap gap-2 mb-4">
        <StageChip href="/crm" active={!stageFilter} label="Todas" count={accounts.length} color="var(--app-text-muted)" />
        {ACCOUNT_STAGES.map((stage) => (
          <StageChip
            key={stage}
            href={`/crm?stage=${stage}`}
            active={stageFilter === stage}
            label={ACCOUNT_STAGE_LABELS[stage]}
            count={countByStage.get(stage) ?? 0}
            color={ACCOUNT_STAGE_COLORS[stage]}
            title={ACCOUNT_STAGE_DESCRIPTIONS[stage]}
          />
        ))}
      </div>

      <div className="mb-4 max-w-md">
        <Suspense fallback={null}>
          <SearchInput placeholder="Buscar por nombre..." />
        </Suspense>
      </div>

      {accounts.length === 0 ? (
        <EmptyState hasFilters={!!q || !!stageFilter} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(18rem, 1fr))", gap: "0.75rem" }}>
          {accounts.map((a) => (
            <Link
              key={a.id}
              href={`/crm/${a.id}`}
              style={{
                display: "block", padding: "1rem", borderRadius: "0.75rem",
                border: "1px solid var(--app-border)", backgroundColor: "var(--app-card-bg)",
                textDecoration: "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
                <span style={{ fontSize: "0.9375rem", fontWeight: 650, color: "var(--app-body-text)" }}>
                  {a.name}
                </span>
                <span
                  style={{
                    flexShrink: 0, fontSize: "0.6875rem", fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                    padding: "0.15rem 0.5rem", borderRadius: "9999px",
                    backgroundColor: `${ACCOUNT_STAGE_COLORS[a.stage]}22`,
                    color: ACCOUNT_STAGE_COLORS[a.stage],
                  }}
                >
                  {ACCOUNT_STAGE_LABELS[a.stage]}
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.625rem", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                  <UserRound style={{ width: "0.8rem", height: "0.8rem" }} />
                  {a._count.contacts} {a._count.contacts === 1 ? "contacto" : "contactos"}
                </span>
                {a._count.projects > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                    <Building2 style={{ width: "0.8rem", height: "0.8rem" }} />
                    {a._count.projects} {a._count.projects === 1 ? "proyecto" : "proyectos"}
                  </span>
                )}
              </div>

              {(a.owner || a.source) && (
                <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                  {a.owner ? `Responsable: ${a.owner.name}` : null}
                  {a.owner && a.source ? " · " : null}
                  {a.source ? `Origen: ${a.source}` : null}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StageChip({
  href, active, label, count, color, title,
}: {
  href: string; active: boolean; label: string; count: number; color: string; title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.4rem",
        padding: "0.35rem 0.75rem", borderRadius: "9999px",
        fontSize: "0.8125rem", fontWeight: active ? 650 : 500, textDecoration: "none",
        border: `1px solid ${active ? color : "var(--app-border)"}`,
        backgroundColor: active ? `${color}1a` : "transparent",
        color: active ? color : "var(--app-nav-text)",
      }}
    >
      {label}
      <span style={{ fontSize: "0.75rem", opacity: 0.75 }}>{count}</span>
    </Link>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div
      style={{
        padding: "3rem 1.5rem", textAlign: "center", borderRadius: "0.75rem",
        border: "1px dashed var(--app-border)", color: "var(--app-text-muted)",
      }}
    >
      <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)" }}>
        {hasFilters ? "Ninguna cuenta coincide" : "Aún no hay cuentas"}
      </p>
      <p style={{ fontSize: "0.875rem", marginTop: "0.35rem" }}>
        {hasFilters
          ? "Prueba con otro filtro o borra la búsqueda."
          : "Las empresas que ya son clientes aparecen aquí. Añade un lead para empezar a seguirlo."}
      </p>
    </div>
  );
}
