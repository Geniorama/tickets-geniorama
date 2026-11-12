import type { Prisma } from "@/generated/prisma";

/**
 * El siguiente número de tarea de un proyecto: el código es `PREFIJO-número`.
 *
 * Calcularlo como «máximo + 1» sin más deja a dos operaciones simultáneas con el
 * mismo número, y ahí dos tareas comparten código. Por eso se toma antes un
 * bloqueo de aviso de Postgres sobre el proyecto, que vive lo que dura la
 * transacción: la segunda espera a que la primera termine y ve su número.
 *
 * Hay que llamarla dentro de una transacción (`tx`) y escribir la tarea en esa
 * misma, o el bloqueo se suelta antes de que el número quede guardado.
 *
 * Contar las tareas del proyecto no sirve como número: al mover o borrar una,
 * la cuenta baja y el siguiente número ya existe.
 */
export async function nextTaskNumber(
  tx: Prisma.TransactionClient,
  projectId: string | null,
): Promise<number> {
  if (projectId) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"task-number:" + projectId}))`;
  }
  const last = await tx.task.findFirst({
    where: { projectId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (last?.number ?? 0) + 1;
}
