/**
 * Genera un prefijo de 2–4 letras a partir del nombre del proyecto.
 * "Sitio Web Geniorama" → "SWG"
 * "Rediseño"            → "RED"
 */
export function projectPrefix(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join("").slice(0, 4).toUpperCase();
}

/** Código legible de una tarea: "SWG-3" */
export function taskCode(projectName: string, taskNumber: number): string {
  return `${projectPrefix(projectName)}-${taskNumber}`;
}
