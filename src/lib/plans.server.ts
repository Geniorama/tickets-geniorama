import { prisma } from "@/lib/prisma";
import { isPlanExpired } from "@/lib/plans";

/** Compute hours used by a plan from time entries on its tickets */
export async function getPlanUsedHours(planId: string): Promise<number> {
  const entries = await prisma.timeEntry.findMany({
    where: { ticket: { planId }, stoppedAt: { not: null } },
    select: { startedAt: true, stoppedAt: true },
  });
  return entries.reduce(
    (acc, e) =>
      acc + (e.stoppedAt!.getTime() - e.startedAt.getTime()) / 3_600_000,
    0
  );
}

/** Returns the first active plan for a client user (checks expiry + hours) */
export async function getClientActivePlan(userId: string) {
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
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  const allPlans = user.companies.flatMap((c) => c.plans);

  for (const plan of allPlans) {
    if (isPlanExpired(plan)) continue;
    if (plan.type === "BOLSA_HORAS" && plan.totalHours !== null) {
      const used = await getPlanUsedHours(plan.id);
      if (used >= plan.totalHours) continue;
    }
    return plan;
  }

  return null;
}
