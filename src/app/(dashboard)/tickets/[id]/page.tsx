import { notFound } from "next/navigation";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
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

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true } },
      client: { select: { id: true, name: true, companies: { select: { name: true } } } },
      plan: { select: { id: true, name: true, type: true } },
      attachments: { orderBy: { createdAt: "asc" } },
      timeEntries: {
        orderBy: { startedAt: "asc" },
        include: { user: { select: { name: true } } },
      },
      comments: {
        where: isStaff(role) ? {} : { isInternal: false },
        include: { author: { select: { name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) notFound();

  // Clientes solo ven tickets que crearon ellos o donde son el cliente asignado
  if (!isStaff(role) && ticket.createdById !== userId && ticket.clientId !== userId) notFound();

  return (
    <div>
      <div className="mb-4">
        <BackButton fallback="/tickets" />
      </div>
      <TicketDetail ticket={ticket} session={session} />
    </div>
  );
}
