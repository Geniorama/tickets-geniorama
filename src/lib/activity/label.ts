/**
 * Cómo se llama una ficha ahora mismo.
 *
 * El historial congela este nombre al escribir cada entrada. Podría resolverse
 * al leer con un join por tipo, y sería una consulta menos, pero entonces el
 * listado global perdería el nombre justo de lo que se borró —y «quién borró el
 * cobro de Acme» es la pregunta que más se le hace a una bitácora—.
 *
 * Devuelve null sin quejarse: un nombre que falta deja la entrada sin título,
 * no sin registrar.
 */

import { prisma } from "@/lib/prisma";
import type { EntityType } from "@/generated/prisma";

export async function entityLabel(
  entityType: EntityType,
  entityId: string,
): Promise<string | null> {
  try {
    switch (entityType) {
      case "TICKET": {
        const row = await prisma.ticket.findUnique({ where: { id: entityId }, select: { title: true } });
        return row?.title ?? null;
      }
      case "TASK": {
        const row = await prisma.task.findUnique({ where: { id: entityId }, select: { title: true } });
        return row?.title ?? null;
      }
      case "PROJECT": {
        const row = await prisma.project.findUnique({ where: { id: entityId }, select: { name: true } });
        return row?.name ?? null;
      }
      case "BILLING": {
        const row = await prisma.billingItem.findUnique({
          where: { id: entityId },
          select: { concept: true, company: { select: { name: true } } },
        });
        if (!row) return null;
        // El concepto solo no basta: media facturación se llama «Mensualidad».
        return `${row.concept} — ${row.company.name}`;
      }
      case "COMPANY": {
        const row = await prisma.company.findUnique({ where: { id: entityId }, select: { name: true } });
        return row?.name ?? null;
      }
      case "CONTACT": {
        const row = await prisma.contact.findUnique({
          where: { id: entityId },
          select: { firstName: true, lastName: true },
        });
        return row ? [row.firstName, row.lastName].filter(Boolean).join(" ") : null;
      }
      case "DEAL": {
        const row = await prisma.deal.findUnique({ where: { id: entityId }, select: { title: true } });
        return row?.title ?? null;
      }
      case "USER": {
        const row = await prisma.user.findUnique({ where: { id: entityId }, select: { name: true } });
        return row?.name ?? null;
      }
      case "VAULT_ENTRY": {
        const row = await prisma.vaultEntry.findUnique({ where: { id: entityId }, select: { title: true } });
        return row?.title ?? null;
      }
      case "SITE": {
        const row = await prisma.site.findUnique({ where: { id: entityId }, select: { name: true } });
        return row?.name ?? null;
      }
      case "PLAN": {
        const row = await prisma.plan.findUnique({ where: { id: entityId }, select: { name: true } });
        return row?.name ?? null;
      }
      case "SERVICE": {
        const row = await prisma.service.findUnique({ where: { id: entityId }, select: { name: true } });
        return row?.name ?? null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
