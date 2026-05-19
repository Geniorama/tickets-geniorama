import { addDays, addMonths, addWeeks, getDate, getDay, setDate, lastDayOfMonth } from "date-fns";
import type { RecurrenceFrequency } from "@/generated/prisma";

export type RecurrencePattern = {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: string | null;
  dayOfMonth?: number | null;
};

export function parseDaysOfWeek(daysOfWeek: string | null | undefined): number[] {
  if (!daysOfWeek) return [];
  return daysOfWeek
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b);
}

export function serializeDaysOfWeek(days: number[]): string {
  return [...new Set(days)].sort((a, b) => a - b).join(",");
}

export function computeNextRunAt(from: Date, pattern: RecurrencePattern): Date {
  const interval = Math.max(1, pattern.interval);
  const base = new Date(from);

  if (pattern.frequency === "DIARIA") {
    return addDays(base, interval);
  }

  if (pattern.frequency === "SEMANAL") {
    const days = parseDaysOfWeek(pattern.daysOfWeek);
    if (days.length === 0) {
      return addWeeks(base, interval);
    }

    const currentDay = getDay(base);
    const remainingInWeek = days.filter((d) => d > currentDay);
    if (remainingInWeek.length > 0) {
      return addDays(base, remainingInWeek[0] - currentDay);
    }
    const weeksToSkip = interval;
    const firstDayNextCycle = days[0];
    const daysUntilNext = 7 * weeksToSkip - currentDay + firstDayNextCycle;
    return addDays(base, daysUntilNext);
  }

  if (pattern.frequency === "MENSUAL") {
    const targetDay = pattern.dayOfMonth ?? getDate(base);
    let candidate = addMonths(base, interval);
    if (targetDay === -1 || targetDay > 28) {
      const last = lastDayOfMonth(candidate);
      const day = targetDay === -1 ? getDate(last) : Math.min(targetDay, getDate(last));
      candidate = setDate(candidate, day);
    } else {
      candidate = setDate(candidate, targetDay);
    }
    return candidate;
  }

  return addDays(base, 1);
}

export function describeRecurrence(pattern: RecurrencePattern): string {
  const interval = Math.max(1, pattern.interval);

  if (pattern.frequency === "DIARIA") {
    return interval === 1 ? "Todos los días" : `Cada ${interval} días`;
  }

  if (pattern.frequency === "SEMANAL") {
    const days = parseDaysOfWeek(pattern.daysOfWeek);
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const cadence = interval === 1 ? "Cada semana" : `Cada ${interval} semanas`;
    if (days.length === 0) return cadence;
    const dayList = days.map((d) => dayNames[d]).join(", ");
    return `${cadence} (${dayList})`;
  }

  if (pattern.frequency === "MENSUAL") {
    const day = pattern.dayOfMonth;
    const cadence = interval === 1 ? "Cada mes" : `Cada ${interval} meses`;
    if (!day) return cadence;
    if (day === -1) return `${cadence} (último día)`;
    return `${cadence} (día ${day})`;
  }

  return "";
}
