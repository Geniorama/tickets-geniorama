// Categorías de tareas, agrupadas. La categoría se guarda como texto libre en
// la BD (Task.category: String?), así que estos valores son los sugeridos en
// los formularios. Mantener los valores existentes para no orfanar tareas ya
// creadas con categorías antiguas.

export interface TaskCategoryGroup {
  label: string;
  options: string[];
}

export const TASK_CATEGORY_GROUPS: TaskCategoryGroup[] = [
  {
    label: "Marketing Digital",
    options: [
      "Estrategia Digital",
      "Redes Sociales",
      "Community Management",
      "Contenido / Copywriting",
      "SEO",
      "SEM / Pauta Digital",
      "Email Marketing",
      "Branding",
      "Diseño Gráfico",
      "Audiovisual / Video",
      "Fotografía",
      "Analítica / Reportes",
      "Influencers",
      "Relaciones Públicas",
    ],
  },
  {
    label: "Desarrollo",
    options: [
      "Frontend",
      "Backend",
      "Diseño",
      "Base de datos",
      "DevOps",
      "QA",
      "Documentación",
      "Página Web",
    ],
  },
  {
    label: "Otro",
    options: ["Otro"],
  },
];

// Lista plana de todas las categorías disponibles.
export const TASK_CATEGORIES: string[] = TASK_CATEGORY_GROUPS.flatMap(
  (g) => g.options
);
