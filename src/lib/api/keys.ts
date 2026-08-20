/**
 * Llaves de la API pública.
 *
 * Una llave no es un superusuario: escribe **en nombre de un usuario** de la
 * plataforma, así que lo que entra por `/api/v1` tiene autor, aparece en los
 * historiales y respeta la misma frontera de datos que la interfaz. Un cliente
 * con llave no ve más de lo que vería entrando por el navegador.
 *
 * El token completo se muestra una sola vez, al crearlo. En la base queda su
 * SHA-256 y el prefijo visible, que es lo que permite identificar y revocar una
 * llave sin conocerla. Se usa SHA-256 y no bcrypt a propósito: el token es
 * aleatorio de 128 bits, no una contraseña que alguien pueda adivinar, y cada
 * petición de la API tiene que verificarlo — un hash lento aquí sería un
 * impuesto por llamada sin ganancia real.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma";
import { TOKEN_PREFIX, type ApiScope } from "@/lib/api/scopes";

export {
  API_SCOPES,
  API_SCOPE_LABELS,
  TOKEN_PREFIX,
  displayPrefix,
  isApiScope,
  type ApiScope,
} from "@/lib/api/scopes";

// ─── Generación ──────────────────────────────────────────────────────────────

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Crea un token nuevo: `gnr_<prefijo>_<secreto>`.
 *
 * El prefijo va dentro del propio token para poder localizar la fila con una
 * sola consulta indexada, sin recorrer todas las llaves comparando hashes.
 */
export function generateToken(): { token: string; prefix: string; tokenHash: string } {
  const prefix = crypto.randomBytes(4).toString("hex");
  const secret = crypto.randomBytes(24).toString("base64url");
  const token = `${TOKEN_PREFIX}_${prefix}_${secret}`;
  return { token, prefix, tokenHash: hashToken(token) };
}

// ─── Autenticación ───────────────────────────────────────────────────────────

export type ApiActor = {
  keyId: string;
  keyLabel: string;
  scopes: string[];
  user: { id: string; name: string; email: string; role: Role };
};

export type AuthFailure = { error: string; status: 401 | 403 };

/**
 * `gnr_<prefijo de 8 hex>_<secreto>`.
 *
 * El corte es por los **dos primeros** guiones bajos y no por todos: el secreto
 * es base64url, un alfabeto que incluye `_`, así que partirlo entero descartaba
 * cuatro de cada diez llaves como si no llevaran cabecera.
 */
const TOKEN_RE = new RegExp(`^${TOKEN_PREFIX}_([0-9a-f]{8})_(.{16,})$`);

function parseToken(req: Request): { token: string; prefix: string } | null {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  const match = TOKEN_RE.exec(token);
  if (!match) return null;
  return { token, prefix: match[1] };
}

/**
 * Resuelve quién llama. Devuelve el actor o el motivo del rechazo — nunca lanza.
 */
export async function authenticateApiKey(req: Request): Promise<ApiActor | AuthFailure> {
  const parsed = parseToken(req);
  if (!parsed) {
    return {
      error: "Falta la cabecera Authorization: Bearer gnr_… o el token está mal formado",
      status: 401,
    };
  }
  const { token, prefix } = parsed;

  const key = await prisma.apiKey
    .findUnique({
      where: { prefix },
      select: {
        id: true,
        label: true,
        tokenHash: true,
        scopes: true,
        isActive: true,
        expiresAt: true,
        user: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
    })
    .catch(() => null);

  if (!key) return { error: "Llave inválida", status: 401 };

  // Comparación de tiempo constante: el prefijo ya es público, pero el hash no
  // tiene por qué filtrarse por cuánto tarda la comparación.
  const expected = Buffer.from(key.tokenHash);
  const provided = Buffer.from(hashToken(token));
  if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
    return { error: "Llave inválida", status: 401 };
  }

  if (!key.isActive) return { error: "Llave revocada", status: 401 };
  if (key.expiresAt && key.expiresAt.getTime() < Date.now()) {
    return { error: "Llave vencida", status: 401 };
  }
  if (!key.user.isActive) {
    return { error: "El usuario dueño de la llave está inactivo", status: 403 };
  }

  // Marca de uso: es lo que permite ver en el panel qué llaves siguen vivas y
  // cuáles se pueden revocar sin romperle nada a nadie. No bloquea la petición.
  void prisma.apiKey
    .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return {
    keyId: key.id,
    keyLabel: key.label,
    scopes: key.scopes,
    user: {
      id: key.user.id,
      name: key.user.name,
      email: key.user.email,
      role: key.user.role,
    },
  };
}

export function isAuthFailure(value: ApiActor | AuthFailure): value is AuthFailure {
  return "error" in value;
}

export function hasScope(actor: ApiActor, scope: ApiScope): boolean {
  return actor.scopes.includes(scope);
}
