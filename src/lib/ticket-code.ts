import { projectPrefix } from "@/lib/task-code";

export const TICKET_FALLBACK_PREFIX = "TKT";

/** Genera el prefijo de un ticket a partir del nombre de la empresa propietaria */
export function ticketPrefix(companyName: string | null | undefined): string {
  if (!companyName) return TICKET_FALLBACK_PREFIX;
  return projectPrefix(companyName);
}

/** Código legible de un ticket: "ACM-12" */
export function ticketCode(prefix: string | null | undefined, number: number): string {
  return `${prefix ?? TICKET_FALLBACK_PREFIX}-${number}`;
}
