// Estado de un proyecto: Activo, Inactivo o Borrador.
//
// No es una columna: se deriva de `isDraft` y `isActive`. Un borrador no es ni
// activo ni inactivo hasta que se publica. Sin dependencias de servidor: lo
// usan insignias, filtros, informes y el payload de los webhooks.

export type ProjectState = "ACTIVO" | "INACTIVO" | "BORRADOR";

export const PROJECT_STATES: ProjectState[] = ["ACTIVO", "INACTIVO", "BORRADOR"];

export const PROJECT_STATE_LABEL: Record<ProjectState, string> = {
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
  BORRADOR: "Borrador",
};

export function projectState(p: { isActive: boolean; isDraft: boolean }): ProjectState {
  if (p.isDraft) return "BORRADOR";
  return p.isActive ? "ACTIVO" : "INACTIVO";
}

/**
 * Filtro de Prisma para un estado. BORRADOR no incluye la condición de autor:
 * esa la pone siempre la regla de visibilidad (solo el creador ve los suyos).
 */
export function projectStateWhere(state: ProjectState) {
  if (state === "BORRADOR") return { isDraft: true };
  return { isDraft: false, isActive: state === "ACTIVO" };
}
