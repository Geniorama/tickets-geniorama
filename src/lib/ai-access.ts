import type { Role } from "@/generated/prisma";
import { isStaff } from "@/lib/roles";
import { clientHasPlanFeature } from "@/lib/plans.server";
import { canAccessTicket } from "@/lib/ticket-access";
import { canClientAccessTask } from "@/lib/task-access";
import { canClientAccessProject } from "@/lib/project-access";

export type AiEntity = { type: "TICKET" | "TASK" | "PROJECT"; id: string };

/**
 * ¿Puede este usuario usar las herramientas de IA sobre esta ficha?
 *
 *   · Equipo  → siempre, como hasta ahora.
 *   · Cliente → solo si uno de sus planes vigentes incluye «Herramientas de
 *               IA» y además puede ver esa ficha concreta. Lo segundo importa:
 *               sin ello, el plan le daría informes de fichas de otra empresa.
 *
 * Devuelve `client: true` para que cada acción deje fuera del prompt lo que un
 * cliente no ve en pantalla (notas internas, documentación del sitio…): lo que
 * entra al modelo puede acabar citado en la respuesta.
 */
export async function authorizeAiTool(
  user: { id: string; role: Role },
  entity: AiEntity,
): Promise<{ client: boolean } | { error: string }> {
  if (isStaff(user.role)) return { client: false };

  if (!(await clientHasPlanFeature(user.id, "aiTools"))) {
    return { error: "Las herramientas de IA no están incluidas en tu plan. Contacta a tu agente para activarlas." };
  }

  const allowed =
    entity.type === "TICKET"
      ? await canAccessTicket(entity.id, user.id, user.role)
      : entity.type === "TASK"
        ? await canClientAccessTask(entity.id, user.id)
        : await canClientAccessProject(entity.id, user.id);

  return allowed ? { client: true } : { error: "Sin permisos" };
}
