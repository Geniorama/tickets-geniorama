// Tipos y etiquetas compartidos para los links de agendamiento de colaboradores.

export type SchedulingCategory = "PROYECTOS" | "SOPORTE";

export interface SchedulingLinkData {
  id: string;
  title: string;
  description: string | null;
  url: string;
  category: SchedulingCategory;
  /** Solo para clientes con soporte prioritario en su plan. */
  isPriority: boolean;
}

export const SCHEDULING_CATEGORIES: SchedulingCategory[] = ["PROYECTOS", "SOPORTE"];

// Etiqueta corta para el badge/selector.
export const SCHEDULING_CATEGORY_LABELS: Record<SchedulingCategory, string> = {
  PROYECTOS: "Proyectos",
  SOPORTE: "Soporte",
};

// Título de sección orientado al cliente.
export const SCHEDULING_CATEGORY_SECTION: Record<SchedulingCategory, string> = {
  PROYECTOS: "Gestión de proyectos",
  SOPORTE: "Soporte",
};

/**
 * Deja los links listos para quien mira: si no puede usar los prioritarios, se
 * les quita la URL. La tarjeta ya no la pinta, pero así ni siquiera sale del
 * servidor.
 */
export function linksForViewer<T extends SchedulingLinkData>(links: T[], priorityUnlocked: boolean): T[] {
  if (priorityUnlocked) return links;
  return links.map((l) => (l.isPriority ? { ...l, url: "" } : l));
}
