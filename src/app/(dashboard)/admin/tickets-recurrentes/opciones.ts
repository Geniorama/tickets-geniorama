import { prisma } from "@/lib/prisma";

/**
 * Los desplegables del formulario, que son los mismos al crear y al editar.
 *
 * Van juntos y en paralelo: son cuatro consultas pequeñas e independientes, y
 * encadenarlas solo haría esperar más a la pantalla.
 */
export async function opcionesRecurrencia() {
  const [clients, staffUsers, plans, sites] = await Promise.all([
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
  ]);

  return {
    clients,
    staffUsers,
    // El nombre de la empresa se aplana aquí: el formulario solo necesita cómo
    // se lee la opción, no la forma de la relación.
    plans: plans.map((p) => ({ id: p.id, name: p.name, companyName: p.company.name })),
    sites: sites.map((s) => ({ id: s.id, name: s.name, companyName: s.company.name })),
  };
}
