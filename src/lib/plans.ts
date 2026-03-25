// Types matching Prisma Plan fields (usable both server and client)
export type PlanLike = {
  type: string;
  totalHours: number | null;
  durationDays: number | null;
  startedAt: Date | string;
  expiresAt: Date | string | null;
  isActive: boolean;
};

/** Returns the effective expiry date (earliest of expiresAt and startedAt+durationDays), or null if no expiry */
export function getEffectiveExpiresAt(
  plan: Pick<PlanLike, "durationDays" | "startedAt" | "expiresAt">
): Date | null {
  const dates: Date[] = [];
  if (plan.expiresAt) dates.push(new Date(plan.expiresAt as string));
  if (plan.durationDays) {
    const d = new Date(plan.startedAt as string);
    d.setDate(d.getDate() + plan.durationDays);
    dates.push(d);
  }
  if (dates.length === 0) return null;
  return dates.reduce((min, d) => (d < min ? d : min));
}

export function isPlanExpired(
  plan: Pick<PlanLike, "durationDays" | "startedAt" | "expiresAt">
): boolean {
  const expiry = getEffectiveExpiresAt(plan);
  return expiry !== null && expiry < new Date();
}

/** Synchronous check (does not check hours; pass usedHours for BOLSA_HORAS) */
export function isPlanEffectivelyActive(plan: PlanLike, usedHours = 0): boolean {
  if (!plan.isActive) return false;
  if (isPlanExpired(plan)) return false;
  if (
    plan.type === "BOLSA_HORAS" &&
    plan.totalHours !== null &&
    usedHours >= plan.totalHours
  )
    return false;
  return true;
}

/** Days until the plan expires (negative = already expired, null = no expiry) */
export function daysUntilExpiry(
  plan: Pick<PlanLike, "durationDays" | "startedAt" | "expiresAt">
): number | null {
  const expiry = getEffectiveExpiresAt(plan);
  if (!expiry) return null;
  return Math.ceil((expiry.getTime() - Date.now()) / 86_400_000);
}

/** Days threshold to show "expiring soon" warnings */
export const PLAN_EXPIRY_WARNING_DAYS = 30;

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
