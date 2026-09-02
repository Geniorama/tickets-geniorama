import { notFound } from "next/navigation";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { can } from "@/lib/access/can";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { linkedTo, notLinkedTo } from "@/lib/vault-links";
import { TicketDetail } from "@/components/tickets/ticket-detail";
import { BackButton } from "@/components/ui/back-button";
import { TicketChecklistPanel } from "@/components/ui/checklist-panel";
import { ActivityPanel } from "@/components/ui/activity-panel";
import { CollaboratorSchedulingCard } from "@/components/collaborator/collaborator-scheduling-card";
import { getClientActivePlan } from "@/lib/plans.server";
import { listComments } from "@/lib/comments";
import { listAttachments } from "@/lib/attachments";
import { listChecklists } from "@/lib/checklists";
import { listTimeEntries } from "@/lib/time-entries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await prisma.ticket.findUnique({ where: { id }, select: { title: true } });
  return { title: ticket?.title ?? "Ticket" };
}

export default async function TicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: ticketId } = await params;
  const session = await getRequiredSession();
  const { id: userId, role } = session.user;
  const staff = isStaff(role);
  const admin = isAdmin(role);
  // Programar un ticket como recurrente es gestionar el módulo, no solo verlo.
  const canManage = await can(session.user, "TICKETS", "gestionar");

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true } },
      reviewers: { select: { id: true, name: true } },
      client: { select: { id: true, name: true, companies: { select: { name: true } } } },
      plan: { select: { id: true, name: true, type: true } },
      site: { select: { id: true, name: true, domain: true, documentation: true, architecture: true } },
    },
  });

  if (!ticket) notFound();

  // Los borradores son privados: solo su creador puede verlos
  if (ticket.isDraft && ticket.createdById !== userId) notFound();

  // Para clientes: verificar acceso via empresa compartida
  if (!staff) {
    let companyClientIds: string[] = [userId];
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        companies: {
          select: {
            users: { where: { role: "CLIENTE" }, select: { id: true } },
          },
        },
      },
    });
    if (currentUser) {
      const ids = [
        ...new Set(currentUser.companies.flatMap((c) => c.users.map((u) => u.id))),
      ];
      if (ids.length > 0) companyClientIds = ids;
    }
    // Clientes ven tickets que crearon ellos O donde el cliente asignado es de su misma empresa
    if (ticket.createdById !== userId && (!ticket.clientId || !companyClientIds.includes(ticket.clientId))) {
      notFound();
    }
  }

  // Comentarios, adjuntos y checklists viven en tablas compartidas: se
  // consultan aparte, ya superado el control de acceso.
  const [comments, attachments, checklists, timeEntries] = await Promise.all([
    listComments({ entityType: "TICKET", entityId: ticketId, includeInternal: staff }),
    listAttachments("TICKET", ticketId),
    listChecklists({ entityType: "TICKET", entityId: ticketId }),
    listTimeEntries({ entityType: "TICKET", entityId: ticketId }),
  ]);

  // La Bóveda es visible solo para el creador y los usuarios con los que se comparte
  const vaultAccessFilter = { OR: [{ createdById: userId }, { sharedWith: { some: { userId } } }] };

  const [linkedVaultEntries, availableVaultEntries, collaborators] = await Promise.all([
    prisma.vaultEntry.findMany({
      where: { ...linkedTo({ entityType: "TICKET", entityId: ticketId }), ...vaultAccessFilter },
      select: { id: true, title: true, username: true, url: true },
      orderBy: { title: "asc" },
    }),
    staff
      ? prisma.vaultEntry.findMany({
          where: { ...notLinkedTo({ entityType: "TICKET", entityId: ticketId }), ...vaultAccessFilter },
          select: { id: true, title: true, username: true, url: true },
          orderBy: { title: "asc" },
        })
      : Promise.resolve([]),
    admin
      ? prisma.user.findMany({
          where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  // El agendamiento de soporte para clientes requiere un paquete (plan) activo.
  const supportSchedulingAvailable = staff
    ? true
    : (await getClientActivePlan(userId)) !== null;

  return (
    <div>
      <div className="mb-4">
        <BackButton fallback="/tickets" />
      </div>
      <TicketDetail
        ticket={{ ...ticket, comments, attachments, timeEntries }}
        session={session}
        totalComments={comments.length}
        linkedVaultEntries={linkedVaultEntries}
        availableVaultEntries={availableVaultEntries}
        collaborators={collaborators}
        checklistSlot={
          <TicketChecklistPanel
            key="checklist"
            ticketId={ticketId}
            initialChecklists={checklists}
            canDelete={admin}
          />
        }
        activitySlot={<ActivityPanel entityType="TICKET" entityId={ticketId} />}
        canManage={canManage}
        checklistItemCount={checklists.reduce((n, c) => n + c.items.length, 0)}
      />
      {supportSchedulingAvailable && (
        <div className="mt-6">
          <CollaboratorSchedulingCard
            userId={ticket.assignedToId}
            category="SOPORTE"
            heading="Agenda una llamada con el agente de soporte"
          />
        </div>
      )}
    </div>
  );
}
