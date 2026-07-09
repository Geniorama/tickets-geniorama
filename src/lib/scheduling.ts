// Tipos y etiquetas compartidos para los links de agendamiento de colaboradores.

export type SchedulingCategory = "PROYECTOS" | "SOPORTE";

export interface SchedulingLinkData {
  id: string;
  title: string;
  description: string | null;
  url: string;
  category: SchedulingCategory;
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
