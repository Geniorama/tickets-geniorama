/**
 * Qué puede ver cada quien, en forma de `where` de Prisma.
 *
 * Existe porque el buscador global lee de seis sitios a la vez y no puede
 * inventarse las reglas: si la lista de proyectos y el buscador definen la
 * visibilidad por separado, tarde o temprano una de las dos se queda vieja y
 * enseña de más. Aquí está escrita una vez, y tanto las páginas como el
 * buscador la importan.
 *
 * Cada función devuelve solo la frontera —sin filtros de la pantalla— para
 * poder combinarla con lo que cada sitio necesite.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma, Role } from "@/generated/prisma";
import { isAdmin } from "@/lib/roles";
import { isStaff } from "@/lib/roles";

export type Viewer = { id: string; role: Role };

/** Las empresas a las que pertenece un cliente. */
async function companyIdsOf(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companies: { select: { id: true } } },
  });
  return (user?.companies ?? []).map((c) => c.id);
}

/**
 * Proyectos visibles.
 *
 * Un proyecto privado solo se ve siendo miembro explícito, y eso vale igual
 * para el equipo: privado significa privado también hacia dentro.
 */
export async function visibleProjectWhere(viewer: Viewer): Promise<Prisma.ProjectWhereInput> {
  if (isAdmin(viewer.role)) return {};

  if (isStaff(viewer.role)) {
    return {
      OR: [
        { isPrivate: false, OR: [{ managerId: viewer.id }, { tasks: { some: { assignedToId: viewer.id } } }] },
        { isPrivate: true, members: { some: { userId: viewer.id } } },
      ],
    };
  }

  const companyIds = await companyIdsOf(viewer.id);
  return {
    OR: [
      { isPrivate: false, companyId: { in: companyIds } },
      { isPrivate: true, members: { some: { userId: viewer.id } } },
    ],
  };
}

/**
 * Tareas visibles.
 *
 * Los borradores son privados de quien los escribe, sea cual sea el rol: por
 * eso la condición va aparte y se aplica siempre.
 */
export async function visibleTaskWhere(viewer: Viewer): Promise<Prisma.TaskWhereInput> {
  const noBorradoresAjenos: Prisma.TaskWhereInput = {
    OR: [{ isDraft: false }, { createdById: viewer.id }],
  };

  if (isAdmin(viewer.role)) return { AND: [noBorradoresAjenos] };

  if (isStaff(viewer.role)) {
    return {
      AND: [
        noBorradoresAjenos,
        { OR: [{ assignedToId: viewer.id }, { project: { managerId: viewer.id } }] },
      ],
    };
  }

  const companyIds = await companyIdsOf(viewer.id);
  return {
    AND: [noBorradoresAjenos, { project: { companyId: { in: companyIds } } }],
  };
}

/**
 * Tickets visibles.
 *
 * Un cliente ve los suyos y los de sus compañeros de empresa: el soporte se
 * lleva por empresa, no por persona, y quien abre un ticket suele no ser quien
 * pregunta después por él.
 */
export async function visibleTicketWhere(viewer: Viewer): Promise<Prisma.TicketWhereInput> {
  // Un borrador es de quien lo escribe, sea del equipo o cliente. La condición
  // es la misma para todos los roles, así que va fuera del reparto.
  const noBorradoresAjenos: Prisma.TicketWhereInput = {
    OR: [{ isDraft: false }, { createdById: viewer.id }],
  };

  if (isStaff(viewer.role)) return noBorradoresAjenos;

  const withCompanies = await prisma.user.findUnique({
    where: { id: viewer.id },
    select: {
      companies: {
        select: { users: { where: { role: "CLIENTE" }, select: { id: true } } },
      },
    },
  });

  const companyClientIds = [
    ...new Set((withCompanies?.companies ?? []).flatMap((c) => c.users.map((u) => u.id))),
  ];
  const clientIds = companyClientIds.length > 0 ? companyClientIds : [viewer.id];

  return {
    AND: [
      noBorradoresAjenos,
      { OR: [{ createdById: viewer.id }, { clientId: { in: clientIds } }] },
    ],
  };
}
