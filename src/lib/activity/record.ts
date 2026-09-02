/**
 * Escribir en el historial.
 *
 * Reglas que se sostienen desde aquí:
 *
 *   · **Nunca lanza.** Guardar el historial no puede tumbar la acción que lo
 *     originó. Si la escritura falla, se pierde una línea de bitácora; si en
 *     cambio propagara el error, se perdería el cobro.
 *   · **No bloquea.** `recordActivity()` no se espera: devuelve void y corre
 *     sola. La ficha se recarga por `revalidatePath` un instante después, que
 *     es tiempo de sobra para una inserción indexada.
 *   · **Solo se guarda lo que dice algo.** Una edición que no cambió ningún
 *     campo vigilado no deja rastro. Sin esta regla, «editó el ticket» aparece
 *     tres veces seguidas cada vez que alguien mueve un estado, porque la misma
 *     acción emite el cambio de estado y la edición.
 *   · **El nombre se congela.** Ni el autor ni el responsable se guardan solo
 *     como id: si esa persona sale de la plataforma, el historial tiene que
 *     seguir diciendo quién hizo qué.
 */

import { prisma } from "@/lib/prisma";
import type { EntityType, Prisma } from "@/generated/prisma";
import { fieldSpec, TRACKED_FIELDS } from "@/lib/activity/catalog";

/**
 * Quién actuó.
 *
 * `name` se acepta opcional porque así lo declara la sesión de NextAuth, y
 * `null` significa la plataforma actuando sola (recurrentes, recordatorios).
 * Misma forma que `HookActor`, a propósito: el mismo objeto sirve para las dos
 * llamadas sin adaptarlo en cada sitio.
 */
export type ActivityActor = { id: string; name?: string | null } | null | undefined;

/** El antes y el después de un campo. */
export type Change = { from: unknown; to: unknown };
export type Changes = Record<string, Change>;

type RecordInput = {
  entityType: EntityType;
  entityId: string;
  action: string;
  /** Cómo se llama la ficha ahora. Se congela para el listado global. */
  label?: string | null;
  changes?: Changes | null;
  meta?: Record<string, unknown> | null;
  actor?: ActivityActor;
  /**
   * Guardar aunque no haya cambios.
   *
   * Por defecto una acción `*.updated` sin cambios vigilados se descarta. Las
   * acciones que son un hecho en sí mismas —crear, borrar, consultar una
   * credencial, enviar un recordatorio— no pasan por ese filtro.
   */
  force?: boolean;
};

/** Acciones que valen por sí solas, aunque no traigan ningún campo cambiado. */
function isSelfEvident(action: string): boolean {
  return !action.endsWith(".updated");
}

/**
 * Los ids de usuario no se guardan crudos: sin el nombre, «cambió el
 * responsable de cmx8f… a cmy2k…» no es historial, es un acertijo. Se resuelven
 * al escribir y no al leer para que la frase sobreviva a la baja de esa persona.
 */
async function resolveUserNames(changes: Changes): Promise<Changes> {
  const ids = new Set<string>();
  for (const [key, change] of Object.entries(changes)) {
    if (fieldSpec(key).kind !== "user") continue;
    for (const value of [change.from, change.to]) {
      if (typeof value === "string" && value) ids.add(value);
    }
  }
  if (ids.size === 0) return changes;

  const users = await prisma.user
    .findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true } })
    .catch(() => []);
  const byId = new Map(users.map((u) => [u.id, u.name]));

  // Un id que ya no resuelve se queda tal cual: es más honesto que inventar un
  // nombre, y la interfaz lo muestra como «alguien que ya no está».
  const named = (value: unknown) =>
    typeof value === "string" && byId.has(value) ? byId.get(value)! : value;

  const out: Changes = {};
  for (const [key, change] of Object.entries(changes)) {
    out[key] =
      fieldSpec(key).kind === "user"
        ? { from: named(change.from), to: named(change.to) }
        : change;
  }
  return out;
}

/**
 * Deja constancia de una acción. No se espera: llámala sin `await`.
 */
export function recordActivity(input: RecordInput): void {
  void (async () => {
    try {
      const changes =
        input.changes && Object.keys(input.changes).length > 0
          ? await resolveUserNames(input.changes)
          : null;

      // Una edición que no movió nada de lo que se vigila no es noticia.
      if (!changes && !input.force && !isSelfEvident(input.action)) return;

      await prisma.activityLog.create({
        data: {
          entityType: input.entityType,
          entityId: input.entityId,
          action: input.action,
          entityLabel: input.label?.slice(0, 300) ?? null,
          changes: (changes ?? undefined) as Prisma.InputJsonValue | undefined,
          meta: (input.meta ?? undefined) as Prisma.InputJsonValue | undefined,
          actorId: input.actor?.id ?? null,
          actorName: input.actor?.name ?? null,
        },
      });
    } catch (err) {
      console.error("[activity] No se pudo registrar la acción:", err);
    }
  })();
}

// ─── Comparar antes y después ────────────────────────────────────────────────

/** Dos valores son el mismo cambio para el historial. */
function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    const ta = a instanceof Date ? a.getTime() : a === null || a === undefined ? null : NaN;
    const tb = b instanceof Date ? b.getTime() : b === null || b === undefined ? null : NaN;
    return ta === tb;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    // El orden de una lista de revisores o de etiquetas no es un cambio.
    const sa = [...a].map(String).sort();
    const sb = [...b].map(String).sort();
    return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
  }
  // `null`, `undefined` y `""` significan lo mismo aquí: campo vacío. Sin esto,
  // un formulario que manda "" donde antes había null inventa un cambio.
  const empty = (v: unknown) => v === null || v === undefined || v === "";
  if (empty(a) && empty(b)) return true;
  return a === b;
}

/** Un valor listo para JSON: las fechas viajan en ISO. */
function toJson(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJson);
  if (value === undefined) return null;
  return value;
}

/**
 * Qué cambió entre dos versiones de una ficha, mirando solo los campos que el
 * catálogo declara vigilados para esa entidad.
 *
 * Recibe objetos sueltos y no filas de Prisma a propósito: quien llama ya sabe
 * de dónde sale cada valor (de la fila vieja, del formulario, de la relación
 * mapeada a nombres) y aquí no hay que adivinarlo.
 */
export function diffFields(
  entityType: EntityType,
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
  extraFields: string[] = [],
): Changes {
  if (!before || !after) return {};

  const tracked = new Set([...(TRACKED_FIELDS[entityType] ?? []), ...extraFields]);
  const changes: Changes = {};

  for (const key of tracked) {
    // Un campo que el formulario no mandó no es un cambio a vacío: es un campo
    // que esta acción no tocaba.
    if (!(key in after)) continue;
    if (sameValue(before[key], after[key])) continue;
    changes[key] = { from: toJson(before[key]), to: toJson(after[key]) };
  }

  return changes;
}

/**
 * El diff de una edición y su registro, en una línea.
 *
 * Es la forma que toman casi todas las llamadas desde las acciones, y tenerla
 * aquí evita repetir el mismo `if (Object.keys(changes).length)` en veinte
 * sitios.
 */
export function recordUpdate(input: {
  entityType: EntityType;
  entityId: string;
  action: string;
  label?: string | null;
  before: Record<string, unknown> | null | undefined;
  after: Record<string, unknown> | null | undefined;
  extraFields?: string[];
  actor?: ActivityActor;
  meta?: Record<string, unknown> | null;
}): void {
  const changes = diffFields(input.entityType, input.before, input.after, input.extraFields);
  if (Object.keys(changes).length === 0) return;

  recordActivity({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    label: input.label,
    changes,
    meta: input.meta,
    actor: input.actor,
  });
}
