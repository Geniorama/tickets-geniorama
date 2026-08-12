/**
 * Núcleo compartido — plantillas.
 *
 * A diferencia del resto del núcleo, `entityType` no señala a qué entidad
 * pertenece la plantilla sino **qué crea**: una plantilla de ticket o de tarea.
 * Por eso no hay `entityId`.
 */

import { prisma } from "@/lib/prisma";
import type { EntityType, Prisma } from "@/generated/prisma";

export type TemplateKind = Extract<EntityType, "TICKET" | "TASK">;

export function listTemplates(kind: TemplateKind, select?: Prisma.TemplateSelect) {
  return prisma.template.findMany({
    where: { entityType: kind },
    orderBy: { name: "asc" },
    ...(select ? { select } : {}),
  });
}

/** Opciones para los selectores de "crear desde plantilla". */
export function listTemplateOptions(kind: TemplateKind) {
  return prisma.template.findMany({
    where: { entityType: kind },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** Una plantilla concreta, verificando que sea del tipo esperado. */
export function findTemplate(kind: TemplateKind, id: string) {
  return prisma.template.findFirst({ where: { id, entityType: kind } });
}

export function createTemplate(kind: TemplateKind, data: Omit<Prisma.TemplateUncheckedCreateInput, "entityType">) {
  return prisma.template.create({ data: { ...data, entityType: kind } });
}

/** El `updateMany` acota por tipo: un id de otra clase de plantilla no aplica. */
export function updateTemplate(
  kind: TemplateKind,
  id: string,
  data: Prisma.TemplateUncheckedUpdateInput,
) {
  return prisma.template.updateMany({ where: { id, entityType: kind }, data });
}

export function deleteTemplate(kind: TemplateKind, id: string) {
  return prisma.template.deleteMany({ where: { id, entityType: kind } });
}
