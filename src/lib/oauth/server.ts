/**
 * Servidor OAuth 2.1 del MCP: registro de apps, códigos de autorización con
 * PKCE, emisión y rotación de tokens, y verificación del token en cada llamada.
 *
 * Como con las llaves de API, en la base solo quedan hashes SHA-256: los tokens
 * son aleatorios de 256 bits, no contraseñas, así que un hash lento no aporta
 * nada y cobraría en cada petición.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma";
import { hashToken } from "@/lib/api/keys";
import {
  ACCESS_TOKEN_TTL,
  AUTH_CODE_TTL,
  OAUTH_SCOPES,
  REFRESH_TOKEN_TTL,
  isOAuthScope,
  mcpResourceUrl,
  type OAuthScope,
} from "@/lib/oauth/config";

function randomToken(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(32).toString("base64url")}`;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Error con el código de RFC 6749 §5.2, listo para devolver tal cual. */
export class OAuthError extends Error {
  constructor(
    public code: string,
    description: string,
    public status = 400,
  ) {
    super(description);
  }
  toJSON() {
    return { error: this.code, error_description: this.message };
  }
}

// ─── Permisos ────────────────────────────────────────────────────────────────

/** Lee `scope` de la petición. Vacío = todos: el usuario los ve al autorizar. */
export function parseScopes(raw: string | null | undefined): OAuthScope[] {
  const requested = (raw ?? "").split(/\s+/).filter(Boolean);
  if (requested.length === 0) return [...OAUTH_SCOPES];
  const valid = requested.filter(isOAuthScope);
  if (valid.length === 0) throw new OAuthError("invalid_scope", `Permisos admitidos: ${OAUTH_SCOPES.join(" ")}`);
  return [...new Set(valid)];
}

// ─── Registro dinámico de clientes (RFC 7591) ────────────────────────────────

const FORBIDDEN_SCHEMES = new Set(["javascript:", "data:", "file:", "vbscript:", "blob:"]);

function isLoopback(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

/**
 * https en cualquier dominio, http solo en la propia máquina (apps de
 * escritorio, RFC 8252) y esquemas propios de app (`cursor://…`).
 */
function validRedirectUri(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.hash) return false;
  if (FORBIDDEN_SCHEMES.has(url.protocol)) return false;
  if (url.protocol === "http:") return isLoopback(url);
  return true;
}

export type RegisteredClient = {
  client_id: string;
  client_secret?: string;
  client_id_issued_at: number;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
};

export async function registerClient(meta: Record<string, unknown>): Promise<RegisteredClient> {
  const redirectUris = Array.isArray(meta.redirect_uris)
    ? meta.redirect_uris.filter((u): u is string => typeof u === "string")
    : [];
  if (redirectUris.length === 0 || redirectUris.length > 10) {
    throw new OAuthError("invalid_redirect_uri", "Hace falta entre 1 y 10 redirect_uris");
  }
  const bad = redirectUris.find((u) => !validRedirectUri(u));
  if (bad) throw new OAuthError("invalid_redirect_uri", `redirect_uri no admitida: ${bad}`);

  const authMethod = typeof meta.token_endpoint_auth_method === "string" ? meta.token_endpoint_auth_method : "none";
  if (!["none", "client_secret_post", "client_secret_basic"].includes(authMethod)) {
    throw new OAuthError("invalid_client_metadata", `token_endpoint_auth_method no admitido: ${authMethod}`);
  }

  const name =
    typeof meta.client_name === "string" && meta.client_name.trim()
      ? meta.client_name.trim().slice(0, 100)
      : "App sin nombre";

  const id = `gnrc_${crypto.randomBytes(16).toString("hex")}`;
  const secret = authMethod === "none" ? undefined : randomToken("gnrs");

  const client = await prisma.oAuthClient.create({
    data: {
      id,
      name,
      redirectUris,
      tokenEndpointAuthMethod: authMethod,
      secretHash: secret ? hashToken(secret) : null,
    },
  });

  return {
    client_id: client.id,
    ...(secret ? { client_secret: secret } : {}),
    client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
    client_name: client.name,
    redirect_uris: client.redirectUris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: authMethod,
  };
}

export async function getClient(clientId: string) {
  if (!clientId) return null;
  return prisma.oAuthClient.findUnique({ where: { id: clientId } });
}

/**
 * La redirect_uri tiene que ser una de las registradas, tal cual. En loopback
 * se ignora el puerto: las apps de escritorio abren uno libre en cada intento.
 */
export function redirectUriAllowed(registered: string[], candidate: string): boolean {
  if (registered.includes(candidate)) return true;
  let c: URL;
  try {
    c = new URL(candidate);
  } catch {
    return false;
  }
  if (!isLoopback(c)) return false;
  return registered.some((r) => {
    try {
      const u = new URL(r);
      return isLoopback(u) && u.protocol === c.protocol && u.hostname === c.hostname && u.pathname === c.pathname;
    } catch {
      return false;
    }
  });
}

/**
 * Autentica al cliente en el endpoint de token. Los públicos solo dicen quiénes
 * son (PKCE hace el resto); los confidenciales prueban su secreto.
 */
export async function authenticateClient(req: Request, form: URLSearchParams) {
  let clientId = form.get("client_id") ?? "";
  let secret = form.get("client_secret") ?? "";

  const header = req.headers.get("authorization") ?? "";
  if (/^Basic\s+/i.test(header)) {
    const decoded = Buffer.from(header.replace(/^Basic\s+/i, ""), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep > 0) {
      clientId = decodeURIComponent(decoded.slice(0, sep));
      secret = decodeURIComponent(decoded.slice(sep + 1));
    }
  }

  const client = await getClient(clientId);
  if (!client) throw new OAuthError("invalid_client", "Cliente desconocido", 401);

  if (client.tokenEndpointAuthMethod !== "none") {
    if (!secret || !client.secretHash || !safeEqual(client.secretHash, hashToken(secret))) {
      throw new OAuthError("invalid_client", "Credenciales del cliente inválidas", 401);
    }
  }
  return client;
}

// ─── Autorización ────────────────────────────────────────────────────────────

/** Comprueba `resource` (RFC 8707): solo se emiten tokens para el MCP. */
export function checkResource(resource: string | null | undefined): string {
  const expected = mcpResourceUrl();
  if (!resource) return expected;
  if (resource.replace(/\/$/, "") !== expected) {
    throw new OAuthError("invalid_target", `El único recurso es ${expected}`);
  }
  return expected;
}

export async function createAuthorizationCode(input: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  scopes: OAuthScope[];
  resource: string;
}): Promise<string> {
  const code = randomToken("gnra");
  await prisma.oAuthAuthorizationCode.create({
    data: {
      codeHash: hashToken(code),
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      scopes: input.scopes,
      resource: input.resource,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL * 1000),
    },
  });
  return code;
}

// ─── Tokens ──────────────────────────────────────────────────────────────────

export type TokenResponse = {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
};

function freshTokens() {
  const access = randomToken("gnro");
  const refresh = randomToken("gnrr");
  const now = Date.now();
  return {
    access,
    refresh,
    data: {
      accessTokenHash: hashToken(access),
      accessExpiresAt: new Date(now + ACCESS_TOKEN_TTL * 1000),
      refreshTokenHash: hashToken(refresh),
      refreshExpiresAt: new Date(now + REFRESH_TOKEN_TTL * 1000),
    },
  };
}

function tokenResponse(access: string, refresh: string, scopes: string[]): TokenResponse {
  return {
    access_token: access,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token: refresh,
    scope: scopes.join(" "),
  };
}

function pkceS256(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

export async function exchangeAuthorizationCode(
  clientId: string,
  form: URLSearchParams,
): Promise<TokenResponse> {
  const code = form.get("code") ?? "";
  const verifier = form.get("code_verifier") ?? "";
  const redirectUri = form.get("redirect_uri") ?? "";
  if (!code || !verifier) throw new OAuthError("invalid_request", "Faltan code o code_verifier");

  const row = await prisma.oAuthAuthorizationCode.findUnique({
    where: { codeHash: hashToken(code) },
    include: { user: { select: { isActive: true } } },
  });
  if (!row || row.clientId !== clientId) throw new OAuthError("invalid_grant", "Código inválido");

  // Un código vale una sola vez. Marcarlo con condición evita que dos
  // peticiones simultáneas lo canjeen las dos.
  const claimed = await prisma.oAuthAuthorizationCode.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) throw new OAuthError("invalid_grant", "El código ya se usó");

  if (row.expiresAt.getTime() < Date.now()) throw new OAuthError("invalid_grant", "El código venció");
  if (redirectUri && redirectUri !== row.redirectUri) throw new OAuthError("invalid_grant", "redirect_uri no coincide");
  if (!safeEqual(pkceS256(verifier), row.codeChallenge)) throw new OAuthError("invalid_grant", "PKCE inválido");
  if (!row.user.isActive) throw new OAuthError("invalid_grant", "El usuario está inactivo");
  checkResource(form.get("resource") ?? row.resource);

  const t = freshTokens();
  await prisma.oAuthGrant.create({
    data: { clientId, userId: row.userId, scopes: row.scopes, ...t.data },
  });
  return tokenResponse(t.access, t.refresh, row.scopes);
}

/**
 * Rota los dos tokens: el refresh usado deja de valer. Se puede pedir menos
 * permisos de los concedidos, nunca más.
 */
export async function refreshGrant(clientId: string, form: URLSearchParams): Promise<TokenResponse> {
  const refresh = form.get("refresh_token") ?? "";
  if (!refresh) throw new OAuthError("invalid_request", "Falta refresh_token");

  const grant = await prisma.oAuthGrant.findUnique({
    where: { refreshTokenHash: hashToken(refresh) },
    include: { user: { select: { isActive: true } } },
  });
  if (!grant || grant.clientId !== clientId || grant.revokedAt) {
    throw new OAuthError("invalid_grant", "refresh_token inválido");
  }
  if (grant.refreshExpiresAt.getTime() < Date.now()) throw new OAuthError("invalid_grant", "refresh_token vencido");
  if (!grant.user.isActive) throw new OAuthError("invalid_grant", "El usuario está inactivo");
  checkResource(form.get("resource"));

  let scopes = grant.scopes;
  if (form.get("scope")) {
    const asked = parseScopes(form.get("scope"));
    if (asked.some((s) => !grant.scopes.includes(s))) {
      throw new OAuthError("invalid_scope", "No se pueden ampliar los permisos al refrescar");
    }
    scopes = asked;
  }

  const t = freshTokens();
  // Condición sobre el hash anterior: si dos refrescos compiten, solo uno gana
  const updated = await prisma.oAuthGrant.updateMany({
    where: { id: grant.id, refreshTokenHash: grant.refreshTokenHash },
    data: { scopes, ...t.data },
  });
  if (updated.count === 0) throw new OAuthError("invalid_grant", "refresh_token ya usado");
  return tokenResponse(t.access, t.refresh, scopes);
}

/** RFC 7009: revoca la conexión entera, sea cual sea el token que llegue. */
export async function revokeToken(clientId: string, token: string): Promise<void> {
  if (!token) return;
  const hash = hashToken(token);
  await prisma.oAuthGrant.updateMany({
    where: {
      clientId,
      revokedAt: null,
      OR: [{ accessTokenHash: hash }, { refreshTokenHash: hash }],
    },
    data: { revokedAt: new Date() },
  });
}

// ─── Verificación en el recurso ──────────────────────────────────────────────

export type OAuthActor = {
  grantId: string;
  clientId: string;
  clientName: string;
  scopes: OAuthScope[];
  expiresAt: number;
  user: { id: string; name: string; email: string; role: Role };
};

/** Resuelve el Bearer del MCP. `null` = token ausente, inválido, vencido o revocado. */
export async function authenticateBearer(req: Request): Promise<OAuthActor | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("gnro_")) return null;

  const grant = await prisma.oAuthGrant
    .findUnique({
      where: { accessTokenHash: hashToken(token) },
      include: {
        client: { select: { name: true } },
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
    })
    .catch(() => null);

  if (!grant || grant.revokedAt || !grant.user.isActive) return null;
  if (grant.accessExpiresAt.getTime() < Date.now()) return null;

  void prisma.oAuthGrant
    .update({ where: { id: grant.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    grantId: grant.id,
    clientId: grant.clientId,
    clientName: grant.client.name,
    scopes: grant.scopes.filter(isOAuthScope),
    expiresAt: Math.floor(grant.accessExpiresAt.getTime() / 1000),
    user: { id: grant.user.id, name: grant.user.name, email: grant.user.email, role: grant.user.role },
  };
}
