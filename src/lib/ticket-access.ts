import { prisma } from "@/lib/prisma";
import { isStaff } from "@/lib/roles";
import type { Role } from "@/generated/prisma";

/**
 * Acceso a un ticket.
 *
 * Es la misma regla que ya aplicaba la página de detalle
 * (`/tickets/[id]/page.tsx`), extraída para poder usarla también en las Server
 * Actions. Antes las acciones del checklist de ticket solo exigían sesión
 * iniciada: cualquier usuario autenticado que adivinara un `ticketId` podía
 * modificar su checklist, incluso el de otra empresa.
 *
 *   · Borrador → solo su creador, sea staff o no.
 *   · Staff    → todos los demás.
 *   · Cliente  → los que creó, o aquellos cuyo cliente asignado pertenece a
 *                alguna de sus empresas.
 */
export async function canAccessTicket(
  ticketId: string,
  userId: string,
  role: Role,
): Promise<boolean> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { createdById: true, clientId: true, isDraft: true },
  });
  if (!ticket) return false;

  // Los borradores son privados: solo su creador puede verlos.
  if (ticket.isDraft && ticket.createdById !== userId) return false;

  if (isStaff(role)) return true;

  if (ticket.createdById === userId) return true;
  if (!ticket.clientId) return false;

  // Clientes de las mismas empresas que este usuario.
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      companies: {
        select: { users: { where: { role: "CLIENTE" }, select: { id: true } } },
      },
    },
  });

  const companyClientIds = [
    ...new Set((currentUser?.companies ?? []).flatMap((c) => c.users.map((u) => u.id))),
  ];

  // Sin empresas compartidas, el único cliente válido es él mismo.
  if (companyClientIds.length === 0) return ticket.clientId === userId;

  return companyClientIds.includes(ticket.clientId);
}
