import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { TicketEditForm } from "@/components/tickets/ticket-edit-form";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Editar ticket — Geniorama Tickets" };

export default async function EditTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMINISTRADOR"]);
  const { id } = await params;

  const [ticket, collaborators, clients, plans, sites] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true, title: true, description: true,
        status: true, priority: true, category: true,
        assignedToId: true, clientId: true, planId: true, siteId: true,
        dueDate: true,
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.user.findMany({
      where: { role: "CLIENTE", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, companies: { select: { id: true, name: true } } },
    }),
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true, companyId: true, company: { select: { name: true } } },
    }),
    prisma.site.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, domain: true, companyId: true },
    }),
  ]);

  if (!ticket) notFound();

  const ticketForForm = {
    ...ticket,
    status: ticket.status as string,
    priority: ticket.priority as string,
    dueDate: ticket.dueDate ? ticket.dueDate.toISOString() : null,
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <BackButton />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar ticket</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <TicketEditForm ticket={ticketForForm} collaborators={collaborators} clients={clients} plans={plans} sites={sites} />
      </div>
    </div>
  );
}
