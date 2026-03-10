import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { TicketEditForm } from "@/components/tickets/ticket-edit-form";

export const metadata = { title: "Editar ticket — Geniorama Tickets" };

export default async function EditTicketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMINISTRADOR"]);
  const { id } = await params;

  const [ticket, collaborators, clients, plans] = await Promise.all([
    prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true, title: true, description: true,
        status: true, priority: true, category: true,
        assignedToId: true, clientId: true, planId: true,
      },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
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
  ]);

  if (!ticket) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar ticket</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <TicketEditForm ticket={ticket} collaborators={collaborators} clients={clients} plans={plans} />
      </div>
    </div>
  );
}
