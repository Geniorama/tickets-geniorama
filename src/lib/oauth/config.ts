/**
 * Constantes del servidor OAuth 2.1 que protege el MCP. Sin nada del servidor:
 * la pantalla de autorización (cliente) también lee las etiquetas de permisos.
 *
 * La app hace a la vez de servidor de autorización y de recurso protegido, con
 * un único recurso: el endpoint MCP. Los permisos son los mismos que los de las
 * llaves de API, salvo `act_as`: una app conectada actúa siempre como quien la
 * autorizó, nunca en nombre de otro.
 */

export const OAUTH_SCOPES = ["read", "write"] as const;
export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export const OAUTH_SCOPE_LABELS: Record<OAuthScope, { label: string; description: string }> = {
  read: {
    label: "Consultar",
    description: "Ver los proyectos, tareas, tickets y comentarios a los que ya tienes acceso.",
  },
  write: {
    label: "Crear y modificar",
    description: "Crear y actualizar tareas y tickets, y comentar, a tu nombre.",
  },
};

export function isOAuthScope(value: string): value is OAuthScope {
  return (OAUTH_SCOPES as readonly string[]).includes(value);
}

/** Vida de cada pieza, en segundos. */
export const AUTH_CODE_TTL = 10 * 60;
export const ACCESS_TOKEN_TTL = 60 * 60;
export const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60;

/** URL pública de la app, sin barra final. Es el `issuer` de OAuth. */
export function appBaseUrl(): string {
  return (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** El recurso protegido: el endpoint MCP. Los tokens se emiten para él. */
export function mcpResourceUrl(): string {
  return `${appBaseUrl()}/api/mcp`;
}

/** Metadatos del recurso (RFC 9728), en la ruta con sufijo que pide el estándar. */
export function protectedResourceMetadataUrl(): string {
  return `${appBaseUrl()}/.well-known/oauth-protected-resource/api/mcp`;
}
