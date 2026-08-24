import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCan, can } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { DEAL_STAGE_COLORS, DEAL_STAGE_LABELS, formatAmount, isClosedStage } from "@/lib/crm/deals";
import { getDealFormData } from "@/lib/crm/form-data";
import { DealForm } from "@/components/crm/deal-form";
import { DealStageSelector } from "@/components/crm/deal-stage-selector";
import { ActivityTimeline, type TimelineActivity } from "@/components/crm/activity-timeline";
import { BackButton } from "@/components/ui/back-button";
import { formatDate } from "@/lib/format-date";
import { fullName } from "@/lib/crm/contact-name";

/**
 * Nada de caché entre navegaciones: el CRM cambia mientras se trabaja, y una
 * tarjeta recién ganada que no aparece al volver al tablero se lee como que no
 * se guardó. `force-dynamic` en el layout no basta para el caché del router del
 * cliente al navegar con un enlace.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await prisma.deal.findUnique({ where: { id }, select: { title: true } });
  return { title: deal?.title ?? "Oportunidad" };
}

/** El `<input type="date">` quiere yyyy-MM-dd, no un ISO completo. */
function asDateInput(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCan("CRM", "ver");
  const { id } = await params;
  const canEdit = await can(session.user, "CRM", "editar");

  const deal = await prisma.deal.findUnique({
    where: { id },
    select: {
      id: true, title: true, stage: true, amount: true, notes: true,
      expectedCloseAt: true, closedAt: true, lostReason: true,
      companyId: true,
      company: { select: { id: true, name: true, stage: true } },
      owner: { select: { name: true } },
      contact: { select: { firstName: true, lastName: true } },
      contactId: true, ownerId: true,
    },
  });

  if (!deal) notFound();

  const activities = await prisma.crmActivity.findMany({
    where: { dealId: deal.id },
    orderBy: { occurredAt: "desc" },
    select: {
      id: true, type: true, summary: true, notes: true, occurredAt: true,
      contact: { select: { firstName: true, lastName: true } },
      deal: { select: { id: true, title: true } },
      createdBy: { select: { name: true } },
    },
  });

  const { accounts, owners } = canEdit
    ? await getDealFormData()
    : { accounts: [], owners: [] };

  const contactos = accounts.find((a) => a.id === deal.companyId)?.contacts ?? [];
  const color = DEAL_STAGE_COLORS[deal.stage];

  return (
    <div>
      <div className="mb-4">
        <BackButton fallback="/crm/oportunidades" />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
              {deal.title}
            </h1>
            <span
              style={{
                fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "0.04em", padding: "0.2rem 0.6rem", borderRadius: "9999px",
                backgroundColor: `${color}22`, color,
              }}
            >
              {DEAL_STAGE_LABELS[deal.stage]}
            </span>
          </div>
          <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.3rem" }}>
            <Link href={`/crm/${deal.company.id}`} style={{ color: "#fd1384", textDecoration: "none" }}>
              {deal.company.name}
            </Link>
            {[
              formatAmount(deal.amount),
              deal.owner ? `Responsable: ${deal.owner.name}` : null,
              deal.contact ? `Contacto: ${fullName(deal.contact)}` : null,
              deal.expectedCloseAt && !isClosedStage(deal.stage) ? `Cierre esperado: ${formatDate(deal.expectedCloseAt)}` : null,
              deal.closedAt ? `Cerrada el ${formatDate(deal.closedAt)}` : null,
            ].filter(Boolean).map((t) => ` · ${t}`).join("")}
          </p>
          {deal.lostReason && (
            <p style={{ fontSize: "0.8125rem", color: "#ef4444", marginTop: "0.35rem" }}>
              Motivo de la pérdida: {deal.lostReason}
            </p>
          )}
        </div>

        {canEdit && <DealStageSelector dealId={deal.id} current={deal.stage} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityTimeline
          accountId={deal.companyId}
          activities={activities.map((a) => ({
            ...a,
            contact: a.contact ? { name: fullName(a.contact) } : null,
          })) as TimelineActivity[]}
          contacts={contactos}
          deals={[]}
          canEdit={canEdit}
          lockedDealId={deal.id}
        />

        {canEdit ? (
          <div>
            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.6rem" }}>
              Datos de la oportunidad
            </h2>
            <DealForm
              accounts={accounts}
              owners={owners}
              fixedAccountId={deal.companyId}
              initial={{
                id: deal.id,
                title: deal.title,
                stage: deal.stage,
                amount: deal.amount,
                expectedCloseAt: asDateInput(deal.expectedCloseAt),
                contactId: deal.contactId,
                ownerId: deal.ownerId,
                notes: deal.notes,
              }}
            />
          </div>
        ) : (
          deal.notes && (
            <div
              style={{
                backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
                borderRadius: "0.75rem", padding: "1.25rem",
              }}
            >
              <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.5rem" }}>
                Notas
              </h2>
              <p style={{ fontSize: "0.875rem", color: "var(--app-nav-text)", whiteSpace: "pre-wrap" }}>
                {deal.notes}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
