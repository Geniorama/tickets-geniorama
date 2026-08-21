import { notFound } from "next/navigation";
import Link from "next/link";
import { FolderKanban, Ticket as TicketIcon, Plus } from "lucide-react";
import { requireCan, can } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_STAGE_COLORS, ACCOUNT_STAGE_LABELS } from "@/lib/crm/accounts";
import { DEAL_STAGE_COLORS, DEAL_STAGE_LABELS, formatAmount, isClosedStage } from "@/lib/crm/deals";
import { ContactList } from "@/components/crm/contact-list";
import { StageSelector } from "@/components/crm/stage-selector";
import { ActivityTimeline, type TimelineActivity } from "@/components/crm/activity-timeline";
import { BackButton } from "@/components/ui/back-button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const account = await prisma.company.findUnique({ where: { id }, select: { name: true } });
  return { title: account?.name ?? "Cuenta" };
}

export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCan("CRM", "ver");
  const { id } = await params;
  const canEdit = await can(session.user, "CRM", "editar");

  const account = await prisma.company.findUnique({
    where: { id },
    select: {
      id: true, name: true, stage: true, source: true, taxId: true,
      owner: { select: { name: true } },
      contacts: {
        where: { isActive: true },
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        select: { id: true, name: true, email: true, phone: true, position: true, isPrimary: true },
      },
      deals: {
        orderBy: [{ closedAt: "asc" }, { expectedCloseAt: "asc" }, { createdAt: "desc" }],
        select: { id: true, title: true, stage: true, amount: true },
      },
      // Lo que ya existe de esta cuenta fuera del CRM: es la razón de reutilizar
      // `Company` en vez de tener una entidad de lead aparte.
      _count: { select: { projects: true, plans: true, sites: true } },
    },
  });

  if (!account) notFound();

  const [ticketCount, activities] = await Promise.all([
    prisma.ticket.count({
      where: { isDraft: false, client: { companies: { some: { id: account.id } } } },
    }),
    // Todo el historial de la cuenta, incluida la actividad ligada a sus
    // oportunidades: por eso `CrmActivity` guarda siempre el `companyId`.
    prisma.crmActivity.findMany({
      where: { companyId: account.id },
      orderBy: { occurredAt: "desc" },
      take: 50,
      select: {
        id: true, type: true, summary: true, notes: true, occurredAt: true,
        contact: { select: { name: true } },
        deal: { select: { id: true, title: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  const abiertas = account.deals.filter((d) => !isClosedStage(d.stage));

  return (
    <div>
      <div className="mb-4">
        <BackButton fallback="/crm" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
              {account.name}
            </h1>
            <span
              style={{
                fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.04em", padding: "0.2rem 0.6rem", borderRadius: "9999px",
                backgroundColor: `${ACCOUNT_STAGE_COLORS[account.stage]}22`,
                color: ACCOUNT_STAGE_COLORS[account.stage],
              }}
            >
              {ACCOUNT_STAGE_LABELS[account.stage]}
            </span>
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.3rem" }}>
            {[
              account.owner ? `Responsable: ${account.owner.name}` : null,
              account.source ? `Origen: ${account.source}` : null,
              account.taxId ? `NIT: ${account.taxId}` : null,
            ].filter(Boolean).join(" · ") || "Sin datos comerciales todavía."}
          </p>
        </div>

        {canEdit && <StageSelector accountId={account.id} current={account.stage} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Las oportunidades van primero: es lo que se viene a mirar. */}
        <div
          style={{
            backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
            borderRadius: "0.75rem", padding: "1.25rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)" }}>
              Oportunidades ({abiertas.length} {abiertas.length === 1 ? "abierta" : "abiertas"})
            </h2>
            {canEdit && (
              <Link
                href={`/crm/oportunidades/nueva?cuenta=${account.id}`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "0.3rem",
                  fontSize: "0.8125rem", fontWeight: 500, color: "#fd1384", textDecoration: "none",
                }}
              >
                <Plus style={{ width: "0.9rem", height: "0.9rem" }} />
                Nueva
              </Link>
            )}
          </div>

          {account.deals.length === 0 ? (
            <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
              Sin oportunidades todavía.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {account.deals.map((d) => (
                <Link
                  key={d.id}
                  href={`/crm/oportunidades/${d.id}`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: "0.75rem", padding: "0.7rem 0.85rem", borderRadius: "0.6rem",
                    border: "1px solid var(--app-border)", textDecoration: "none",
                    opacity: isClosedStage(d.stage) ? 0.65 : 1,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)" }}>
                      {d.title}
                    </span>
                    <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: DEAL_STAGE_COLORS[d.stage], textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {DEAL_STAGE_LABELS[d.stage]}
                    </span>
                  </span>
                  {d.amount !== null && (
                    <span style={{ fontSize: "0.875rem", fontWeight: 650, color: "var(--app-body-text)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                      {formatAmount(d.amount)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        <ContactList accountId={account.id} contacts={account.contacts} canEdit={canEdit} />

        {/* Qué tiene ya esta cuenta en el resto de la app */}
        <div
          style={{
            backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
            borderRadius: "0.75rem", padding: "1.25rem",
          }}
        >
          <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.35rem" }}>
            Relación actual
          </h2>
          <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginBottom: "1rem" }}>
            Todo lo que esta cuenta ya tiene en la operación. Al ganarla, nada de esto hay que migrarlo.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <RelationRow icon={FolderKanban} label="Proyectos" value={account._count.projects} href={`/proyectos?companyId=${account.id}`} />
            <RelationRow icon={TicketIcon} label="Tickets" value={ticketCount} href={`/tickets?companyId=${account.id}`} />
            <RelationRow label="Planes contratados" value={account._count.plans} />
            <RelationRow label="Sitios y apps" value={account._count.sites} />
          </div>
        </div>

        {/* El historial ocupa el ancho completo: es una lectura larga, no una ficha. */}
        <div className="lg:col-span-2">
          <ActivityTimeline
            accountId={account.id}
            activities={activities as TimelineActivity[]}
            contacts={account.contacts.map((c) => ({ id: c.id, name: c.name }))}
            deals={abiertas.map((d) => ({ id: d.id, title: d.title }))}
            canEdit={canEdit}
          />
        </div>
      </div>
    </div>
  );
}

function RelationRow({
  icon: Icon, label, value, href,
}: {
  icon?: React.ElementType; label: string; value: number; href?: string;
}) {
  const contenido = (
    <>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", fontSize: "0.875rem", color: "var(--app-nav-text)" }}>
        {Icon && <Icon style={{ width: "0.9rem", height: "0.9rem", color: "var(--app-icon-color)" }} />}
        {label}
      </span>
      <span style={{ fontSize: "0.9375rem", fontWeight: 650, color: value > 0 ? "var(--app-body-text)" : "var(--app-text-muted)" }}>
        {value}
      </span>
    </>
  );

  const estilo: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0.6rem 0.75rem", borderRadius: "0.5rem",
    border: "1px solid var(--app-border)", textDecoration: "none",
  };

  return href && value > 0
    ? <Link href={href} style={estilo}>{contenido}</Link>
    : <div style={estilo}>{contenido}</div>;
}
