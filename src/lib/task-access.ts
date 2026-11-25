import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/roles";
import type { Role } from "@/generated/prisma";

/**
 * Acceso de clientes al detalle de una tarea.
 *
 * Un cliente puede abrir el detalle de cualquier tarea publicada de un proyecto
 * que ya puede ver (misma regla que `canClientAccessProject`): proyecto público
 * de una de sus empresas, o proyecto privado del que es miembro.
 *
 * Se conserva la excepción anterior: si el staff lo menciona en un comentario o
 * lo pone como revisor, puede abrir esa tarea aunque el proyecto sea privado y
 * no sea miembro (ya recibe notificación y correo con el enlace). Esa excepción
 * sigue exigiendo que el proyecto sea de una de sus empresas, para que una
 * mención accidental en el proyecto de otro cliente no filtre nada.
 *
 * Nunca se abren borradores: ni tareas ni proyectos sin publicar.
 */

/**
 * Tareas del lote en cuyos comentarios se menciona a este usuario.
 *
 * Las menciones se guardan en línea como `@[Nombre](userId)`, así que basta con
 * buscar el sufijo `](userId)` en el cuerpo. Los comentarios viven en la tabla
 * compartida y ya no son una relación de Task, así que esto es una consulta
 * aparte en vez de un filtro anidado.
 */
async function mentionedTaskIds(
  taskIds: string[],
  userId: string,
): Promise<Set<string>> {
  if (taskIds.length === 0) return new Set();

  const rows = await prisma.comment.findMany({
    where: {
      entityType: "TASK",
      entityId: { in: taskIds },
      body: { contains: `](${userId})` },
    },
    select: { entityId: true },
    distinct: ["entityId"],
  });

  return new Set(rows.map((r) => r.entityId));
}

/** IDs de las empresas del cliente. */
async function getCompanyIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companies: { select: { id: true } } },
  });
  return (user?.companies ?? []).map((c) => c.id);
}

/**
 * ¿Puede este cliente abrir el detalle de esta tarea?
 * Solo aplica a CLIENTE — para staff/admin usa las reglas de cada página.
 */
export async function canClientAccessTask(
  taskId: string,
  userId: string,
): Promise<boolean> {
  const accessible = await getClientAccessibleTaskIds([taskId], userId);
  return accessible.has(taskId);
}

/**
 * Versión por lotes para el listado de tareas del proyecto: devuelve el
 * subconjunto de `taskIds` cuyo detalle puede abrir el cliente.
 */
export async function getClientAccessibleTaskIds(
  taskIds: string[],
  userId: string,
): Promise<Set<string>> {
  if (taskIds.length === 0) return new Set();

  const companyIds = await getCompanyIds(userId);

  const candidates = await prisma.task.findMany({
    where: {
      id: { in: taskIds },
      isDraft: false,
      // Un proyecto en borrador no se abre a clientes hasta publicarse
      project: {
        isDraft: false,
        OR: [
          // Visible por la regla general: público de su empresa…
          { isPrivate: false, companyId: { in: companyIds } },
          // …o privado donde es miembro
          { isPrivate: true, members: { some: { userId } } },
          // Posible excepción por mención/revisión: privado de su empresa
          { isPrivate: true, companyId: { in: companyIds } },
        ],
      },
    },
    select: {
      id: true,
      reviewers: { where: { id: userId }, select: { id: true } },
      project: {
        select: {
          isPrivate: true,
          members: { where: { userId }, select: { userId: true } },
        },
      },
    },
  });

  // Las tareas visibles por la regla general entran directo; las de un proyecto
  // privado donde no es miembro necesitan mención o ser revisor.
  const visible = new Set<string>();
  const needInvolvement: typeof candidates = [];
  for (const t of candidates) {
    const p = t.project;
    if (p && (!p.isPrivate || p.members.length > 0)) visible.add(t.id);
    else needInvolvement.push(t);
  }

  if (needInvolvement.length > 0) {
    const mentioned = await mentionedTaskIds(
      needInvolvement.map((t) => t.id),
      userId,
    );
    for (const t of needInvolvement) {
      if (t.reviewers.length > 0 || mentioned.has(t.id)) visible.add(t.id);
    }
  }

  return visible;
}

/**
 * Guardia para Server Actions que operan sobre una tarea (comentar, reaccionar).
 * El staff conserva su acceso actual; el cliente debe poder abrir la tarea.
 * Evita que las acciones abiertas queden invocables por cualquier usuario
 * autenticado que adivine un `taskId`.
 */
export async function canInteractWithTask(
  taskId: string,
  userId: string,
  role: Role,
): Promise<boolean> {
  if (isStaff(role)) return true;
  return canClientAccessTask(taskId, userId);
}
