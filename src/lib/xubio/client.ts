/**
 * El cliente de la API de Xubio.
 *
 * Autenticación OAuth2 «client credentials»: se piden las credenciales por
 * Basic Auth al TokenEndpoint y devuelve un token que vale una hora. El token
 * se guarda en memoria porque pedir uno nuevo en cada llamada gasta una ida y
 * vuelta por nada, y el proceso vive lo suficiente (PM2, no serverless) para
 * que valga la pena.
 *
 * Las credenciales nunca se escriben en un log ni salen a pantalla. Lo único
 * que se cuenta hacia fuera es si están puestas o no.
 */

const BASE = process.env.XUBIO_BASE_URL ?? "https://xubio.com/API/1.1";

export type XubioError = { error: string; detalle?: string };

export function estaConfigurado(): boolean {
  return Boolean(process.env.XUBIO_CLIENT_ID && process.env.XUBIO_CLIENT_SECRET);
}

export function loQueFalta(): string[] {
  return ["XUBIO_CLIENT_ID", "XUBIO_CLIENT_SECRET"].filter((v) => !process.env[v]);
}

let token: { valor: string; expira: number } | null = null;

/** Descarta el token guardado. Se usa al reintentar tras un 401. */
export function olvidarToken() {
  token = null;
}

async function pedirToken(): Promise<{ ok: true; token: string } | { ok: false } & XubioError> {
  if (!estaConfigurado()) {
    return { ok: false, error: `Falta configurar en el servidor: ${loQueFalta().join(", ")}` };
  }

  // Margen de un minuto: un token que caduca entre que se comprueba y se usa
  // provoca un 401 que parece un fallo de credenciales y no lo es.
  if (token && Date.now() < token.expira - 60_000) return { ok: true, token: token.valor };

  const basic = Buffer.from(
    `${process.env.XUBIO_CLIENT_ID}:${process.env.XUBIO_CLIENT_SECRET}`,
  ).toString("base64");

  let res: Response;
  try {
    res = await fetch(`${BASE}/TokenEndpoint?grant_type=client_credentials`, {
      method: "GET",
      headers: { Authorization: `Basic ${basic}`, Accept: "application/json" },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: "No se pudo contactar con Xubio", detalle: (e as Error).message };
  }

  const cuerpo = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      error: res.status === 401
        ? "Xubio rechazó las credenciales"
        : `Xubio respondió ${res.status} al pedir el token`,
      detalle: cuerpo.slice(0, 300),
    };
  }

  try {
    const json = JSON.parse(cuerpo) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return { ok: false, error: "Xubio no devolvió un token", detalle: cuerpo.slice(0, 300) };
    token = { valor: json.access_token, expira: Date.now() + (json.expires_in ?? 3600) * 1000 };
    return { ok: true, token: json.access_token };
  } catch {
    return { ok: false, error: "La respuesta del token no era JSON", detalle: cuerpo.slice(0, 300) };
  }
}

export type Respuesta<T> = { ok: true; datos: T } | ({ ok: false } & XubioError);

/**
 * Una llamada a la API, con el token puesto.
 *
 * Reintenta una vez ante un 401: el token caduca a la hora y Xubio contesta
 * «token died». Es esperado, no un error que deba ver nadie.
 */
export async function xubio<T>(
  ruta: string,
  init: RequestInit = {},
  reintentando = false,
): Promise<Respuesta<T>> {
  const t = await pedirToken();
  if (!t.ok) return t;

  let res: Response;
  try {
    res = await fetch(`${BASE}/${ruta.replace(/^\//, "")}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init.headers,
        Authorization: `Bearer ${t.token}`,
      },
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, error: "No se pudo contactar con Xubio", detalle: (e as Error).message };
  }

  if (res.status === 401 && !reintentando) {
    olvidarToken();
    return xubio<T>(ruta, init, true);
  }

  const cuerpo = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      error: `Xubio respondió ${res.status}`,
      // Recortado: sus errores a veces llegan como una página entera de HTML.
      detalle: cuerpo.slice(0, 500),
    };
  }

  if (!cuerpo.trim()) return { ok: true, datos: null as T };

  try {
    return { ok: true, datos: JSON.parse(cuerpo) as T };
  } catch {
    return { ok: false, error: "La respuesta de Xubio no era JSON", detalle: cuerpo.slice(0, 500) };
  }
}
