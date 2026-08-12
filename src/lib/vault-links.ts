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
