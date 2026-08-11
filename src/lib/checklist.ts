/**
 * Un checklist es un grupo con título y una lista ordenada de ítems.
 *
 * Se usa en dos contextos:
 * - Borrador: formularios de creación y plantillas, donde los ítems todavía no
 *   existen en base de datos (`ChecklistGroup`, serializado como JSON).
 * - Persistido: el modelo compartido `Checklist` y sus `ChecklistItem`
 *   (ver `src/lib/checklists.ts`).
 */

export type ChecklistGroup = { title: string; items: string[] };

/** Título que reciben los checklists sin nombre propio. */
export const DEFAULT_CHECKLIST_TITLE = "Checklist";

const MAX_TITLE_LENGTH = 120;
const MAX_ITEM_LENGTH = 200;

function cleanTitle(value: unknown): string {
  const t = typeof value === "string" ? value.trim() : "";
  return (t || DEFAULT_CHECKLIST_TITLE).slice(0, MAX_TITLE_LENGTH);
}

function cleanItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((i) => (typeof i === "string" ? i.trim() : ""))
    .filter((i) => i.length > 0)
    .map((i) => i.slice(0, MAX_ITEM_LENGTH));
}

/**
 * Normaliza cualquier valor guardado a grupos válidos. Tolera el formato
 * antiguo (`string[]` plano), que se convierte en un único checklist con el
 * título por defecto: las plantillas creadas antes de la migración siguen
 * funcionando aunque su JSON llegue sin normalizar.
 */
export function normalizeChecklistGroups(value: unknown): ChecklistGroup[] {
  if (!Array.isArray(value)) return [];

  // Formato antiguo: lista plana de títulos de ítem.
  if (value.every((v) => typeof v === "string")) {
    const items = cleanItems(value);
    return items.length > 0 ? [{ title: DEFAULT_CHECKLIST_TITLE, items }] : [];
  }

  return value
    .map((group) => {
      if (typeof group !== "object" || group === null) return null;
      const g = group as Record<string, unknown>;
      return { title: cleanTitle(g.title), items: cleanItems(g.items) };
    })
    .filter((g): g is ChecklistGroup => g !== null)
    // Un checklist sin ítems no aporta nada a una tarea/ticket recién creado.
    .filter((g) => g.items.length > 0);
}

/** Lee el campo `checklist` de un formulario (JSON) y lo normaliza. */
export function parseChecklistGroups(raw: FormDataEntryValue | null): ChecklistGroup[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    return normalizeChecklistGroups(JSON.parse(raw));
  } catch {
    return [];
  }
}

/** Total de ítems entre todos los grupos. */
export function countChecklistItems(groups: ChecklistGroup[]): number {
  return groups.reduce((sum, g) => sum + g.items.length, 0);
}

/** Resumen para los listados de plantillas: "3 ítems" · "1 ítem" · "—". */
export function checklistLabel(value: unknown): string {
  const total = countChecklistItems(normalizeChecklistGroups(value));
  return total > 0 ? `${total} ítem${total !== 1 ? "s" : ""}` : "—";
}
