import { notFound } from "next/navigation";
import Link from "next/link";
import { FolderKanban, Ticket as TicketIcon } from "lucide-react";
import { requireCan, can } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_STAGE_COLORS, ACCOUNT_STAGE_LABELS } from "@/lib/crm/accounts";
import { ContactList } from "@/components/crm/contact-list";
import { StageSelector } from "@/components/crm/stage-selector";
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
      // Lo que ya existe de esta cuenta fuera del CRM: es la razón de reutilizar
      // `Company` en vez de tener una entidad de lead aparte.
      _count: { select: { projects: true, plans: true, sites: true } },
    },
  });

  if (!account) notFound();

  const ticketCount = await prisma.ticket.count({
    where: { isDraft: false, client: { companies: { some: { id: account.id } } } },
  });

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
