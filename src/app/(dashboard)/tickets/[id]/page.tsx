import { notFound } from "next/navigation";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { TicketDetail } from "@/components/tickets/ticket-detail";
import { BackButton } from "@/components/ui/back-button";

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

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true } },
      client: { select: { id: true, name: true, companies: { select: { name: true } } } },
      plan: { select: { id: true, name: true, type: true } },
      site: { select: { id: true, name: true, domain: true, documentation: true, architecture: true } },
      attachments: { orderBy: { createdAt: "asc" } },
      timeEntries: {
        orderBy: { startedAt: "asc" },
        include: { user: { select: { name: true } } },
      },
      comments: {
        where: isStaff(role) ? {} : { isInternal: false },
        include: {
          author: { select: { name: true, role: true } },
          reactions: { select: { type: true, userId: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) notFound();

  // Clientes solo ven tickets que crearon ellos o donde son el cliente asignado
  if (!staff && ticket.createdById !== userId && ticket.clientId !== userId) notFound();

  const vaultAccessFilter = admin
    ? {}
    : { OR: [{ createdById: userId }, { sharedWith: { some: { userId } } }] };

  const [linkedVaultEntries, availableVaultEntries, collaborators] = await Promise.all([
    prisma.vaultEntry.findMany({
      where: { tickets: { some: { ticketId } }, ...vaultAccessFilter },
      select: { id: true, title: true, username: true, url: true },
      orderBy: { title: "asc" },
    }),
    staff
      ? prisma.vaultEntry.findMany({
          where: { tickets: { none: { ticketId } }, ...vaultAccessFilter },
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

  return (
    <div>
      <div className="mb-4">
        <BackButton fallback="/tickets" />
      </div>
      <TicketDetail
        ticket={ticket}
        session={session}
        linkedVaultEntries={linkedVaultEntries}
        availableVaultEntries={availableVaultEntries}
        collaborators={collaborators}
      />
    </div>
  );
}
