/**
 * Los estados, escritos como se leen.
 *
 * Derivarlos del enum (`EN_REVISION` → «En revision») pierde las tildes, y un
 * texto mal acentuado en un resultado de búsqueda se nota. Las insignias de
 * cada módulo tienen sus propios mapas porque además llevan color e icono;
 * este es solo el texto, para quien únicamente necesita eso.
 */

export const STATUS_LABELS: Record<string, string> = {
  // Tickets
  POR_ASIGNAR:    "Por asignar",
  ABIERTO:        "Abierto",
  CERRADO:        "Cerrado",
  // Tareas y tickets
  PENDIENTE:      "Pendiente",
  EN_PROGRESO:    "En progreso",
  EN_REVISION:    "En revisión",
  COMPLETADO:     "Completado",
  // Proyectos
  PLANIFICACION:  "Planificación",
  EN_DESARROLLO:  "En desarrollo",
  PAUSADO:        "Pausado",
};

/** Con respaldo, para que un estado nuevo salga legible sin tocar esto. */
export function statusLabel(value: string): string {
  const conocido = STATUS_LABELS[value];
  if (conocido) return conocido;
  const texto = value.replace(/_/g, " ").toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
