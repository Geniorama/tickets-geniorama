import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/roles";
import type { Role } from "@/generated/prisma";

/**
 * Acceso de clientes al detalle de una tarea.
 *
 * El detalle de tarea es de uso interno (v1.39.0): los clientes solo ven el
 * listado de solo lectura dentro del proyecto. La excepción es cuando el staff
 * los involucra de forma deliberada — los menciona en un comentario o los pone
 * como revisores. En ese caso ya reciben notificación y correo con un enlace al
 * detalle, así que también deben poder abrirlo.
 *
 * Se exige además que la tarea pertenezca a un proyecto de una de sus empresas,
 * para que una mención accidental en el proyecto de otro cliente no filtre nada.
 * Un proyecto privado NO bloquea: la mención pesa más, pero el acceso se limita
 * a esa tarea (no al proyecto).
 */

/**
 * Filtro Prisma: la tarea involucra deliberadamente a este usuario.
 * Las menciones se guardan en línea como `@[Nombre](userId)`, así que basta con
 * buscar el sufijo `](userId)` dentro del cuerpo del comentario.
 */
function involvesUser(userId: string) {
  return {
    OR: [
      { reviewers: { some: { id: userId } } },
      { comments: { some: { body: { contains: `](${userId})` } } } },
    ],
  };
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
  const companyIds = await getCompanyIds(userId);
  if (companyIds.length === 0) return false;

  const match = await prisma.task.findFirst({
    where: {
      id: taskId,
      isDraft: false,
      project: { companyId: { in: companyIds } },
      ...involvesUser(userId),
    },
    select: { id: true },
  });

  return match !== null;
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
  if (companyIds.length === 0) return new Set();

  const tasks = await prisma.task.findMany({
    where: {
      id: { in: taskIds },
      isDraft: false,
      project: { companyId: { in: companyIds } },
      ...involvesUser(userId),
    },
    select: { id: true },
  });

  return new Set(tasks.map((t) => t.id));
}

/**
 * Guardia para Server Actions que operan sobre una tarea (comentar, reaccionar).
 * El staff conserva su acceso actual; el cliente debe estar mencionado o ser
 * revisor. Evita que las acciones abiertas queden invocables por cualquier
 * usuario autenticado que adivine un `taskId`.
 */
export async function canInteractWithTask(
  taskId: string,
  userId: string,
  role: Role,
): Promise<boolean> {
  if (isStaff(role)) return true;
  return canClientAccessTask(taskId, userId);
}
