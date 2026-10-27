import { prisma } from "@/lib/prisma";
import { normalizeChecklistGroups } from "@/lib/checklist";

/**
 * Los desplegables del formulario, que son los mismos al crear y al editar.
 *
 * Van juntos y en paralelo: son cinco consultas pequeñas e independientes, y
 * encadenarlas solo haría esperar más a la pantalla.
 */
export async function opcionesRecurrencia() {
  const [clients, staffUsers, plans, sites, plantillas] = await Promise.all([
    prisma.user.findMany({
      where: { role: "CLIENTE", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, company: { select: { name: true } } },
    }),
    prisma.site.findMany({
      where: { isActive: true },
      orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, company: { select: { name: true } } },
    }),
    prisma.template.findMany({
      where: { entityType: "TICKET" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        title: true,
        description: true,
        priority: true,
        category: true,
        checklist: true,
      },
    }),
  ]);

  return {
    clients,
    staffUsers,
    // El nombre de la empresa se aplana aquí: el formulario solo necesita cómo
    // se lee la opción, no la forma de la relación.
    plans: plans.map((p) => ({ id: p.id, name: p.name, companyName: p.company.name })),
    sites: sites.map((s) => ({ id: s.id, name: s.name, companyName: s.company.name })),
    ticketTemplates: plantillas.map((t) => ({ ...t, checklist: normalizeChecklistGroups(t.checklist) })),
  };
}
