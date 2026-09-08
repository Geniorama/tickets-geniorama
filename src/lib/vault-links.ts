/**
 * Núcleo compartido — vínculos de bóveda.
 *
 * Relacionan una entrada de la bóveda con un ticket, un proyecto o lo que
 * venga. La relación con `VaultEntry` sigue siendo clave foránea real, así que
 * borrar una entrada arrastra sus vínculos; lo que hay que limpiar a mano es
 * el otro lado (`deleteVaultLinksFor`).
 */

import { prisma } from "@/lib/prisma";
import type { EntityType, Prisma } from "@/generated/prisma";

type Entity = { entityType: EntityType; entityId: string };

/** Filtro para las entradas de bóveda vinculadas a una entidad. */
export function linkedTo({ entityType, entityId }: Entity): Prisma.VaultEntryWhereInput {
  return { links: { some: { entityType, entityId } } };
}

/** Filtro para las que NO lo están (las disponibles para vincular). */
export function notLinkedTo({ entityType, entityId }: Entity): Prisma.VaultEntryWhereInput {
  return { links: { none: { entityType, entityId } } };
}

/**
 * Qué entradas puede ver alguien: las suyas y las que le compartieron.
 *
 * Vive aquí porque es la misma frontera en los tres sitios que la necesitan
 * —la ficha, el alta y las acciones de vincular—, y tres copias de un filtro de
 * acceso son tres sitios donde puede quedarse desactualizado uno.
 */
export function vaultAccessFilter(userId: string): Prisma.VaultEntryWhereInput {
  return { OR: [{ createdById: userId }, { sharedWith: { some: { userId } } }] };
}

/**
 * Vincula varias entradas de una, descartando las que quien lo pide no puede
 * ver.
 *
 * Descarta en vez de fallar a propósito: los ids llegan de un formulario y lo
 * que sobra es ruido, no un ataque que merezca tirar la operación entera —el
 * ticket ya está creado cuando esto corre—. Devuelve cuántas quedaron.
 */
export async function linkVaultEntries(
  entity: Entity,
  vaultEntryIds: string[],
  userId: string,
): Promise<number> {
  const pedidas = [...new Set(vaultEntryIds.filter(Boolean))];
  if (pedidas.length === 0) return 0;

  const permitidas = await prisma.vaultEntry.findMany({
    where: { id: { in: pedidas }, ...vaultAccessFilter(userId) },
    select: { id: true },
  });

  for (const entrada of permitidas) {
    await linkVaultEntry(entity, entrada.id);
  }
  return permitidas.length;
}

export function linkVaultEntry(entity: Entity, vaultEntryId: string) {
  return prisma.vaultLink.upsert({
    where: {
      entityType_entityId_vaultEntryId: { ...entity, vaultEntryId },
    },
    create: { ...entity, vaultEntryId },
    update: {},
  });
}

export function unlinkVaultEntry(entity: Entity, vaultEntryId: string) {
  return prisma.vaultLink.deleteMany({ where: { ...entity, vaultEntryId } });
}

/** Reemplazo del borrado en cascada del lado de la entidad. */
export function deleteVaultLinksFor(
  entityType: EntityType,
  entityIds: string | string[],
  client: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const ids = Array.isArray(entityIds) ? entityIds : [entityIds];
  if (ids.length === 0) return Promise.resolve({ count: 0 });

  return client.vaultLink.deleteMany({
    where: { entityType, entityId: { in: ids } },
  });
}
