import { prisma } from "@/lib/prisma";
import { isPlanExpired } from "@/lib/plans";

// El cálculo vive en el núcleo compartido: los registros de tiempo ya no son
// una relación del ticket. Se reexporta para no romper a quien lo importaba.
export { getPlanUsedHours } from "@/lib/time-entries";
import { getPlanUsedHours } from "@/lib/time-entries";

/** Returns the first active plan for a client user (checks expiry + hours) */
export async function getClientActivePlan(userId: string) {
  return (await getClientActivePlans(userId))[0] ?? null;
}

/**
 * ¿Puede el cliente usar los links de agendamiento prioritarios? Basta con que
 * uno de sus planes vigentes —activo, sin caducar y con horas— lo incluya.
 */
export async function clientHasPrioritySupport(userId: string): Promise<boolean> {
  return (await getClientActivePlans(userId)).some((p) => p.prioritySupport);
}

/** Todos los planes vigentes del cliente, en el orden en que se evalúan. */
async function getClientActivePlans(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      companies: {
        where: { isActive: true },
        select: {
          plans: {
            where: { isActive: true },
            select: {
              id: true,
              type: true,
              totalHours: true,
              durationDays: true,
              startedAt: true,
              expiresAt: true,
              isActive: true,
              prioritySupport: true,
            },
          },
        },
      },
    },
  });

  if (!user) return [];

  const allPlans = user.companies.flatMap((c) => c.plans);
  const valid: typeof allPlans = [];

  for (const plan of allPlans) {
    if (isPlanExpired(plan)) continue;
    if (plan.type === "BOLSA_HORAS" && plan.totalHours !== null) {
      const used = await getPlanUsedHours(plan.id);
      if (used >= plan.totalHours) continue;
    }
    valid.push(plan);
  }

  return valid;
}
