/**
 * Lógica de arrastre compartida entre el panel de checklists (persistido) y el
 * editor en borrador de los formularios. Ambos manejan la misma estructura:
 * una lista de checklists, cada uno con sus ítems.
 *
 * En un mismo `DndContext` conviven dos niveles de arrastre, así que los ids se
 * prefijan para saber qué se está moviendo:
 * - `list:<id>`  el checklist completo
 * - `item:<id>`  un ítem
 * - `zone:<id>`  el cuerpo de un checklist, para poder soltar en uno vacío
 */

export const listDragId = (id: string) => `list:${id}`;
export const itemDragId = (id: string) => `item:${id}`;
export const zoneDragId = (id: string) => `zone:${id}`;

type DragRef = { type: "list" | "item" | "zone"; id: string };

export function parseDragId(raw: string | number): DragRef | null {
  const value = String(raw);
  const sep = value.indexOf(":");
  if (sep === -1) return null;
  const type = value.slice(0, sep);
  const id = value.slice(sep + 1);
  if (type !== "list" && type !== "item" && type !== "zone") return null;
  return { type, id };
}

type DragItem = { id: string };
type DragList<T extends DragItem> = { id: string; items: T[] };

function move<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Aplica un drop sobre la estructura de checklists. Cubre los tres casos:
 * reordenar checklists, reordenar ítems dentro de uno y mover un ítem a otro.
 * Devuelve `null` cuando el drop no cambia nada.
 */
export function applyChecklistDrag<T extends DragItem, L extends DragList<T>>(
  lists: L[],
  activeRaw: string | number,
  overRaw: string | number,
): L[] | null {
  const active = parseDragId(activeRaw);
  const over = parseDragId(overRaw);
  if (!active || !over) return null;

  // ── Reordenar checklists ──
  if (active.type === "list") {
    const from = lists.findIndex((l) => l.id === active.id);
    // Si se suelta sobre un ítem, vale el checklist que lo contiene.
    const targetId =
      over.type === "item" ? lists.find((l) => l.items.some((i) => i.id === over.id))?.id : over.id;
    const to = lists.findIndex((l) => l.id === targetId);
    if (from === -1 || to === -1 || from === to) return null;
    return move(lists, from, to);
  }

  if (active.type !== "item") return null;

  // ── Mover un ítem ──
  const fromList = lists.findIndex((l) => l.items.some((i) => i.id === active.id));
  if (fromList === -1) return null;
  const fromIndex = lists[fromList].items.findIndex((i) => i.id === active.id);

  let toList: number;
  let toIndex: number;
  if (over.type === "item") {
    toList = lists.findIndex((l) => l.items.some((i) => i.id === over.id));
    if (toList === -1) return null;
    toIndex = lists[toList].items.findIndex((i) => i.id === over.id);
  } else {
    // Soltado sobre el cuerpo (o la cabecera) de un checklist: va al final.
    toList = lists.findIndex((l) => l.id === over.id);
    if (toList === -1) return null;
    toIndex = lists[toList].items.length;
  }

  if (fromList === toList) {
    if (fromIndex === toIndex) return null;
    const items = move(lists[fromList].items, fromIndex, toIndex);
    return lists.map((l, i) => (i === fromList ? { ...l, items } : l));
  }

  const moved = lists[fromList].items[fromIndex];
  return lists.map((l, i) => {
    if (i === fromList) return { ...l, items: l.items.filter((_, x) => x !== fromIndex) };
    if (i === toList) {
      const items = [...l.items];
      items.splice(toIndex, 0, moved);
      return { ...l, items };
    }
    return l;
  });
}
