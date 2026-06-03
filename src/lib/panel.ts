import type { Priority } from "@/generated/prisma";
import { isOverdue } from "@/lib/overdue";

export type PanelItemKind = "ticket" | "task";

export interface PanelItem {
  id: string;
  kind: PanelItemKind;
  code: string;
  title: string;
  status: string;
  priority: Priority;
  assignedTo: string | null;
  context: string | null; // empresa (ticket) o proyecto (tarea)
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  href: string;
}

export const PRIORITY_RANK: Record<Priority, number> = {
  CRITICA: 0,
  ALTA: 1,
  MEDIA: 2,
  BAJA: 3,
};

const KIND_LABEL: Record<PanelItemKind, string> = { ticket: "Ticket", task: "Tarea" };

/**
 * Ordena los ítems del panel. Sin `sortBy` aplica un orden "inteligente" para
 * priorizar: vencidos primero, luego por prioridad (crítica → baja) y por fecha
 * de vencimiento más próxima.
 */
export function sortPanelItems(
  items: PanelItem[],
  sortBy: string | undefined,
  sortDir: "asc" | "desc"
): PanelItem[] {
  const dir = sortDir === "desc" ? -1 : 1;
  const time = (d: Date | null) => (d ? d.getTime() : null);

  // Comparador que empuja los null al final, sin importar la dirección.
  const byDate = (a: Date | null, b: Date | null) => {
    const ta = time(a);
    const tb = time(b);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return (ta - tb) * dir;
  };

  const sorted = [...items];

  switch (sortBy) {
    case "kind":
      sorted.sort((a, b) => KIND_LABEL[a.kind].localeCompare(KIND_LABEL[b.kind]) * dir);
      break;
    case "code":
      sorted.sort((a, b) => a.code.localeCompare(b.code, "es", { numeric: true }) * dir);
      break;
    case "title":
      sorted.sort((a, b) => a.title.localeCompare(b.title, "es") * dir);
      break;
    case "status":
      sorted.sort((a, b) => a.status.localeCompare(b.status) * dir);
      break;
    case "priority":
      sorted.sort((a, b) => (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * dir);
      break;
    case "assignedTo":
      sorted.sort((a, b) => (a.assignedTo ?? "~").localeCompare(b.assignedTo ?? "~", "es") * dir);
      break;
    case "dueDate":
      sorted.sort((a, b) => byDate(a.dueDate, b.dueDate));
      break;
    case "updatedAt":
      sorted.sort((a, b) => byDate(a.updatedAt, b.updatedAt));
      break;
    default:
      // Orden inteligente de priorización
      sorted.sort((a, b) => {
        const ao = isOverdue(a.dueDate, a.status) ? 0 : 1;
        const bo = isOverdue(b.dueDate, b.status) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (pr !== 0) return pr;
        const ta = time(a.dueDate);
        const tb = time(b.dueDate);
        if (ta === null && tb === null) return b.updatedAt.getTime() - a.updatedAt.getTime();
        if (ta === null) return 1;
        if (tb === null) return -1;
        return ta - tb;
      });
  }

  return sorted;
}
