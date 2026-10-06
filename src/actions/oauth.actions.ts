"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";

export type ConnectedApp = {
  id: string;
  name: string;
  scopes: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
};

/**
 * Apps MCP que el usuario ha autorizado y siguen vivas. Cada autorización es una
 * fila: si conectó la misma app dos veces, aparecen las dos y se cortan por
 * separado.
 */
export async function getMyConnectedApps(): Promise<ConnectedApp[]> {
  const session = await getRequiredSession();
  const grants = await prisma.oAuthGrant.findMany({
    where: { userId: session.user.id, revokedAt: null, refreshExpiresAt: { gt: new Date() } },
    select: { id: true, scopes: true, createdAt: true, lastUsedAt: true, client: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return grants.map((g) => ({
    id: g.id,
    name: g.client.name,
    scopes: g.scopes,
    createdAt: g.createdAt,
    lastUsedAt: g.lastUsedAt,
  }));
}

/** Desconecta una app: su token deja de valer en la siguiente llamada. */
export async function revokeConnectedApp(grantId: string) {
  const session = await getRequiredSession();
  const result = await prisma.oAuthGrant.updateMany({
    where: { id: grantId, userId: session.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (result.count === 0) return { error: "Conexión no encontrada" };
  revalidatePath("/integraciones");
  return { success: true };
}
