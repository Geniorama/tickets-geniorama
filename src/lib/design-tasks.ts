// Tareas de diseño: cuáles son y en qué formatos se piden los bocetos con IA.
// Sin dependencias de servidor: lo usan el panel de la tarea y las acciones.

/**
 * Categorías de tarea (ver lib/task-categories) en las que el panel de IA
 * ofrece el brief creativo y los bocetos. Coinciden por nombre exacto porque
 * la categoría se guarda como texto.
 */
export const DESIGN_CATEGORIES = [
  "Redes Sociales",
  "Community Management",
  "Diseño Gráfico",
  "Branding",
  "Diseño",
];

export function isDesignTask(category: string | null | undefined): boolean {
  return !!category && DESIGN_CATEGORIES.includes(category);
}

export type SketchFormatId = "cuadrado" | "vertical" | "horizontal";

/**
 * Formatos de boceto. El tamaño es el que admite el modelo de imagen, no el de
 * exportación: un boceto vertical sale a 1024×1536 y la pieza final se arma a
 * 1080×1350 o 1080×1920 en la herramienta de diseño.
 */
export const SKETCH_FORMATS: {
  id: SketchFormatId;
  label: string;
  hint: string;
  size: "1024x1024" | "1024x1536" | "1536x1024";
}[] = [
  { id: "cuadrado", label: "Cuadrado", hint: "Post de feed 1:1", size: "1024x1024" },
  { id: "vertical", label: "Vertical", hint: "Feed 4:5, historias y reels", size: "1024x1536" },
  { id: "horizontal", label: "Horizontal", hint: "Portadas, LinkedIn, banners", size: "1536x1024" },
];

/** Tope de bocetos por petición: cada imagen cuesta y tarda. */
export const MAX_SKETCHES = 3;
