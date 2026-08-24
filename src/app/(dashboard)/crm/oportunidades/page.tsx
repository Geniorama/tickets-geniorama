import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCan, can } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { DEAL_STAGES, OPEN_STAGES, formatAmount, isClosedStage } from "@/lib/crm/deals";
import { DealBoard, type BoardDeal } from "@/components/crm/deal-board";

/**
 * Nada de caché entre navegaciones: el CRM cambia mientras se trabaja, y una
 * tarjeta recién ganada que no aparece al volver al tablero se lee como que no
 * se guardó. `force-dynamic` en el layout no basta para el caché del router del
 * cliente al navegar con un enlace.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Oportunidades" };

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Promise<{ cerradas?: string }>;
}) {
  const session = await requireCan("CRM", "ver");
  const canEdit = await can(session.user, "CRM", "editar");
  const { cerradas } = await searchParams;

  // Por defecto el tablero muestra solo lo vivo: las ganadas y perdidas se
  // acumulan sin límite y taparían el pipeline en unos meses.
  const verCerradas = cerradas === "1";
  const stages = verCerradas ? DEAL_STAGES : OPEN_STAGES;

  const [deals, cerradasOcultas] = await Promise.all([
    prisma.deal.findMany({
      where: { stage: { in: stages } },
      orderBy: [{ expectedCloseAt: "asc" }, { createdAt: "desc" }],
      select: {
        id: true, title: true, stage: true, amount: true, expectedCloseAt: true,
        company: { select: { id: true, name: true } },
        owner: { select: { name: true } },
      },
    }),
    // Cuántas quedan fuera del tablero. Sin este número, marcar una
    // oportunidad como ganada la hacía desaparecer sin decir a dónde: el
    // filtro está bien, esconderlo en silencio no.
    prisma.deal.count({ where: { closedAt: { not: null } } }),
  ]);

  const abiertas = deals.filter((d) => !isClosedStage(d.stage));
  const enJuego = abiertas.reduce((sum, d) => sum + (d.amount ?? 0), 0);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Oportunidades
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
            {abiertas.length === 0
              ? "Nada abierto en el pipeline."
              : `${abiertas.length} ${abiertas.length === 1 ? "abierta" : "abiertas"}${
                  enJuego > 0 ? ` · ${formatAmount(enJuego)} en juego` : ""
                }`}
            {/* Lo que el tablero está escondiendo, dicho en voz alta. */}
            {!verCerradas && cerradasOcultas > 0 && (
              <>
                {" · "}
                <Link href="/crm/oportunidades?cerradas=1" style={{ color: "#fd1384", textDecoration: "none" }}>
                  {cerradasOcultas} {cerradasOcultas === 1 ? "cerrada oculta" : "cerradas ocultas"}
                </Link>
              </>
            )}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <Link
            href={verCerradas ? "/crm/oportunidades" : "/crm/oportunidades?cerradas=1"}
            style={{
              fontSize: "0.8125rem", padding: "0.45rem 0.85rem", borderRadius: "0.5rem",
              border: "1px solid var(--app-border)", color: "var(--app-nav-text)", textDecoration: "none",
            }}
          >
            {verCerradas
              ? "Ocultar cerradas"
              : `Ver cerradas${cerradasOcultas > 0 ? ` (${cerradasOcultas})` : ""}`}
          </Link>
          {canEdit && (
            <Link
              href="/crm/oportunidades/nueva"
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                backgroundColor: "#fd1384", color: "#fff", borderRadius: "0.5rem",
                padding: "0.55rem 1rem", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none",
              }}
            >
              <Plus style={{ width: "1rem", height: "1rem" }} />
              Nueva oportunidad
            </Link>
          )}
        </div>
      </div>

      <DealBoard deals={deals as BoardDeal[]} stages={stages} canEdit={canEdit} />
    </div>
  );
}
