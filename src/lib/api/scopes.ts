/**
 * Permisos de las llaves de API, sin nada del servidor.
 *
 * Está separado de `keys.ts` porque la pantalla de administración —que corre en
 * el navegador— necesita las etiquetas, y `keys.ts` arrastra Prisma y `crypto`.
 * Un archivo de constantes evita meter la base de datos en el bundle del cliente.
 */

/** Prefijo de marca: hace obvio de dónde salió un token filtrado. */
export const TOKEN_PREFIX = "gnr";

export const API_SCOPES = ["read", "write", "act_as"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

export const API_SCOPE_LABELS: Record<ApiScope, { label: string; description: string }> = {
  read: {
    label: "Lectura",
    description: "Consultar proyectos, tickets, tareas y comentarios.",
  },
  write: {
    label: "Escritura",
    description: "Crear y actualizar tickets, tareas y comentarios.",
  },
  act_as: {
    label: "Actuar en nombre de otro",
    description:
      "Permite mandar «onBehalfOf» para atribuir lo que se cree a otro usuario. Necesario para bots que atienden a varias personas.",
  },
};

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}

/** La parte pública de una llave: `gnr_a1b2c3d4…`. */
export function displayPrefix(prefix: string): string {
  return `${TOKEN_PREFIX}_${prefix}…`;
}
