import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { BackButton } from "@/components/ui/back-button";
import { RecurringTicketForm } from "@/components/admin/recurring-ticket-form";
import { parseDaysOfWeek } from "@/lib/recurrence";
import { normalizeChecklistGroups } from "@/lib/checklist";
import { formatDateTimeLong } from "@/lib/format-date";
import { ticketCode } from "@/lib/ticket-code";
import { opcionesRecurrencia } from "../../opciones";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tpl = await prisma.recurringTicketTemplate.findUnique({
    where: { id },
    select: { title: true },
  });
  return { title: tpl ? `Editar: ${tpl.title}` : "Editar ticket recurrente" };
}

export default async function EditRecurringTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCan("TICKETS", "gestionar");
  const { id } = await params;

  const [tpl, opciones] = await Promise.all([
    prisma.recurringTicketTemplate.findUnique({
      where: { id },
      include: {
        // Los últimos que abrió: es la comprobación que se hace al entrar
        // —«¿está funcionando esto?»— y sin ella habría que ir a buscarlos a la
        // lista de tickets filtrando a mano.
        generatedTickets: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, title: true, prefix: true, number: true, createdAt: true },
        },
      },
    }),
    opcionesRecurrencia(),
  ]);

  if (!tpl) notFound();

  const initial = {
    id: tpl.id,
    title: tpl.title,
    description: tpl.description,
    priority: tpl.priority,
    category: tpl.category,
    checklist: normalizeChecklistGroups(tpl.checklist),
    clientId: tpl.clientId,
    planId: tpl.planId,
    siteId: tpl.siteId,
    assignedToId: tpl.assignedToId,
    reviewerIds: tpl.reviewerIds,
    frequency: tpl.frequency,
    interval: tpl.interval,
    daysOfWeek: parseDaysOfWeek(tpl.daysOfWeek),
    dayOfMonth: tpl.dayOfMonth,
    startDate: tpl.startDate.toISOString().slice(0, 10),
    endDate: tpl.endDate ? tpl.endDate.toISOString().slice(0, 10) : null,
    dueDateOffsetDays: tpl.dueDateOffsetDays,
    isActive: tpl.isActive,
  };

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback="/admin/tickets-recurrentes" />
      </div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "0.5rem" }}>
        Editar ticket recurrente
      </h1>
      <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginBottom: "1.5rem" }}>
        Próximo: {formatDateTimeLong(tpl.nextRunAt)} ·{" "}
        {tpl.lastRunAt ? `Último: ${formatDateTimeLong(tpl.lastRunAt)}` : "Todavía no ha abierto ninguno"}
      </p>

      <RecurringTicketForm
        initial={initial}
        clients={opciones.clients}
        staffUsers={opciones.staffUsers}
        plans={opciones.plans}
        sites={opciones.sites}
      />

      {tpl.generatedTickets.length > 0 && (
        <div
          style={{
            backgroundColor: "var(--app-card-bg)",
            border: "1px solid var(--app-border)",
            borderRadius: "0.75rem",
            padding: "1.25rem",
            marginTop: "1rem",
          }}
        >
          <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.75rem" }}>
            Últimos tickets que abrió
          </h3>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {tpl.generatedTickets.map((t) => (
              <li key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", fontSize: "0.8125rem" }}>
                <Link
                  href={`/tickets/${t.id}`}
                  style={{ color: "var(--app-body-text)", textDecoration: "none" }}
                >
                  <span style={{ color: "var(--app-text-muted)", marginRight: "0.4rem" }}>
                    {ticketCode(t.prefix, t.number)}
                  </span>
                  {t.title}
                </Link>
                <span style={{ color: "var(--app-text-muted)", whiteSpace: "nowrap" }}>
                  {formatDateTimeLong(t.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
