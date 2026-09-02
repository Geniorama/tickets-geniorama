import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { BackButton } from "@/components/ui/back-button";
import {
  RecurringTicketForm,
  type RecurringTicketFormData,
} from "@/components/admin/recurring-ticket-form";
import { opcionesRecurrencia } from "../opciones";

export const metadata = { title: "Nuevo ticket recurrente" };

/**
 * Alta de una recurrencia.
 *
 * Con `?desde=<ticketId>` llega precargada con los datos de un ticket que ya
 * existe: es el destino del botón «Hacer recurrente» de la ficha. Convertir a
 * mano algo que ya se repite obligaba a volver a teclear cliente, plan y sitio,
 * y ahí es donde se cuela el error que deja el mantenimiento mensual sin plan.
 */
export default async function NewRecurringTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string }>;
}) {
  await requireCan("TICKETS", "gestionar");

  const { desde } = await searchParams;
  const { clients, staffUsers, plans, sites } = await opcionesRecurrencia();

  let initial: RecurringTicketFormData | undefined;

  if (desde) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: desde },
      select: {
        title: true,
        description: true,
        priority: true,
        category: true,
        clientId: true,
        planId: true,
        siteId: true,
        assignedToId: true,
        reviewers: { select: { id: true } },
      },
    });

    if (ticket) {
      initial = {
        title: ticket.title,
        description: ticket.description,
        priority: ticket.priority,
        category: ticket.category,
        // El checklist no se hereda: el del ticket original ya está medio
        // marcado, y copiar ítems tachados a una plantilla nueva no ayuda.
        checklist: [],
        clientId: ticket.clientId,
        planId: ticket.planId,
        siteId: ticket.siteId,
        assignedToId: ticket.assignedToId,
        reviewerIds: ticket.reviewers.map((r) => r.id),
        frequency: "MENSUAL",
        interval: 1,
        daysOfWeek: [],
        dayOfMonth: null,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: null,
        dueDateOffsetDays: 0,
        isActive: true,
      };
    }
  }

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback="/admin/tickets-recurrentes" />
      </div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "0.5rem" }}>
        Nuevo ticket recurrente
      </h1>
      {initial && (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1.5rem" }}>
          Precargado desde un ticket existente. Revisa el patrón antes de guardar: por defecto
          se repite cada mes desde hoy.
        </p>
      )}
      {!initial && <div style={{ marginBottom: "1.5rem" }} />}

      <RecurringTicketForm
        initial={initial}
        clients={clients}
        staffUsers={staffUsers}
        plans={plans}
        sites={sites}
      />
    </div>
  );
}
