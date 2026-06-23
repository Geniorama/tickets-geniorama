import { getRequiredSession } from "@/lib/auth-helpers";
import { isAdmin, isStaff } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { TicketForm } from "@/components/tickets/ticket-form";
import { TemplatePicker } from "@/components/tasks/template-picker";
import { getClientActivePlan } from "@/lib/plans.server";

export const metadata = { title: "Nuevo ticket" };

export default async function NewTicketPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const session = await getRequiredSession();
  const admin = isAdmin(session.user.role);
  const staff = isStaff(session.user.role);
  const { template: templateId } = await searchParams;

  // Check plan for clients
  if (session.user.role === "CLIENTE") {
    const activePlan = await getClientActivePlan(session.user.id);
    if (!activePlan) {
      return (
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo ticket</h1>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <p className="text-sm font-medium text-amber-800">No tienes un plan activo</p>
            <p className="text-sm text-amber-700 mt-1">
              Contacta a tu agente para activar un plan de soporte o bolsa de horas.
            </p>
          </div>
        </div>
      );
    }
  }

  const [collaborators, clients, plans, sites, reviewerCandidates, templates] = await Promise.all([
    admin
      ? prisma.user.findMany({
          where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, role: true },
        })
      : Promise.resolve([]),
    admin
      ? prisma.user.findMany({
          where: { role: "CLIENTE", isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, companies: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
    admin
      ? prisma.plan.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, type: true, companyId: true, company: { select: { name: true } } },
        })
      : Promise.resolve([]),
    // Para CLIENTE: sitios de sus propias empresas
    // Para ADMIN: todos los sitios activos (el form filtra por cliente seleccionado)
    session.user.role === "CLIENTE"
      ? prisma.site.findMany({
          where: {
            isActive: true,
            company: { users: { some: { id: session.user.id } } },
          },
          orderBy: { name: "asc" },
          select: { id: true, name: true, domain: true, companyId: true },
        })
      : prisma.site.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true, domain: true, companyId: true },
        }),
    // Revisores elegibles: cualquier usuario activo (solo para staff)
    staff
      ? prisma.user.findMany({
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
    // Plantillas de ticket (solo staff)
    staff
      ? prisma.ticketTemplate.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);

  // Plantilla seleccionada para prellenar el formulario
  const template = staff && templateId
    ? await prisma.ticketTemplate.findUnique({ where: { id: templateId } })
    : null;
  const prefill = template
    ? {
        title: template.title,
        description: template.description,
        priority: template.priority as string,
        category: template.category,
        checklist: template.checklist,
      }
    : undefined;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo ticket</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {staff && <TemplatePicker templates={templates} selected={templateId} />}
        <TicketForm
          key={templateId ?? "blank"}
          collaborators={collaborators}
          clients={clients}
          plans={plans}
          sites={sites}
          reviewerCandidates={reviewerCandidates}
          canSetDueDate={staff}
          canSaveDraft={staff}
          prefill={prefill}
        />
      </div>
    </div>
  );
}
