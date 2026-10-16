/**
 * Diagnóstico en vivo de un sitio: ¿por qué no carga?
 *
 * Responde la pregunta que más se hace un cliente con lo que se puede comprobar
 * desde fuera, en el orden en que falla un sitio de verdad:
 *
 *   1. **DNS** — si el dominio no resuelve, nada más importa: suele ser un
 *      dominio vencido o unos DNS mal apuntados.
 *   2. **Certificado** — un SSL vencido hace que el navegador bloquee el sitio
 *      aunque el servidor responda perfecto.
 *   3. **Respuesta HTTP** — servidor caído, error 5xx, página que no existe.
 *
 * No decide nada: devuelve las comprobaciones y unas conclusiones en lenguaje
 * llano para que quien atiende (una persona o un agente) las cuente.
 *
 * El dominio sale siempre de la ficha del sitio, nunca de lo que escriba el
 * cliente. Aun así se niega a sondear direcciones privadas: un dominio mal
 * cargado no debe convertir esto en una forma de mirar dentro de la red. Y el
 * servidor del sitio es del cliente: podría responder con un 302 hacia una IP
 * interna, o su DNS cambiar entre la consulta y la conexión. Por eso la IP se
 * valida en cada conexión (`safeLookup`) y las redirecciones se siguen a mano.
 */

import dns from "node:dns/promises";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;

export type SiteCheck = {
  domain: string;
  checkedAt: string;
  dns: { ok: boolean; addresses: string[]; error: string | null };
  ssl: {
    ok: boolean;
    validTo: string | null;
    daysLeft: number | null;
    issuer: string | null;
    error: string | null;
  } | null;
  http: {
    ok: boolean;
    status: number | null;
    finalUrl: string | null;
    ms: number | null;
    error: string | null;
  } | null;
  /** Conclusiones en español, de la más grave a la menos. Vacío si todo va bien. */
  findings: string[];
};

/** `https://www.Ejemplo.com/ruta` → `www.ejemplo.com`. */
export function hostOf(domain: string): string | null {
  const raw = domain.trim().toLowerCase();
  if (!raw) return null;
  try {
    const host = new URL(/^[a-z]+:\/\//.test(raw) ? raw : `https://${raw}`).hostname;
    return host || null;
  } catch {
    return null;
  }
}

function isPrivate(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80") || v6.startsWith("::ffff:");
}

/**
 * Resuelve como siempre, pero no deja conectar con una dirección interna. Se
 * pasa como `lookup` a cada conexión, así que vale también para cada salto de
 * una redirección y para un DNS que responda distinto la segunda vez.
 */
const safeLookup: net.LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses: LookupAddress[]) => {
    if (err) return callback(err, "", 4);
    if (addresses.length === 0 || addresses.some((a) => isPrivate(a.address))) {
      return callback(Object.assign(new Error("dirección interna"), { code: "EPRIVATE" }), "", 4);
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

const DNS_ERRORS: Record<string, string> = {
  ENOTFOUND: "el dominio no existe o no tiene registros",
  ENODATA: "el dominio no tiene direcciones configuradas",
  ESERVFAIL: "los servidores DNS del dominio no responden",
  ETIMEOUT: "la consulta DNS tardó demasiado",
};

async function checkDns(host: string): Promise<SiteCheck["dns"]> {
  const [v4, v6] = await Promise.allSettled([dns.resolve4(host), dns.resolve6(host)]);
  const addresses = [
    ...(v4.status === "fulfilled" ? v4.value : []),
    ...(v6.status === "fulfilled" ? v6.value : []),
  ];
  if (addresses.length > 0) return { ok: true, addresses, error: null };
  const err = (v4.status === "rejected" ? v4.reason : null) as NodeJS.ErrnoException | null;
  const code = err?.code ?? "";
  return { ok: false, addresses: [], error: DNS_ERRORS[code] ?? (err?.message || "no resuelve") };
}

/**
 * Lee el certificado sin exigir que sea válido: lo que interesa es justamente
 * saber si lo es y cuándo vence. `authorized` dice si el navegador lo aceptaría.
 */
function checkSsl(host: string): Promise<NonNullable<SiteCheck["ssl"]>> {
  return new Promise((resolve) => {
    const done = (r: NonNullable<SiteCheck["ssl"]>) => { socket.destroy(); resolve(r); };
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: TIMEOUT_MS, lookup: safeLookup }, () => {
      const cert = socket.getPeerCertificate();
      if (!cert || !cert.valid_to) {
        return done({ ok: false, validTo: null, daysLeft: null, issuer: null, error: "el servidor no presentó certificado" });
      }
      const validTo = new Date(cert.valid_to);
      const daysLeft = Math.floor((validTo.getTime() - Date.now()) / 86_400_000);
      const issuer = (cert.issuer?.O as string | undefined) ?? (cert.issuer?.CN as string | undefined) ?? null;
      const authCode = socket.authorized ? null : String(socket.authorizationError ?? "");
      const authErr = authCode === null ? null : (HTTP_ERRORS[authCode] ?? `el certificado no es de confianza (${authCode})`);
      done({
        ok: socket.authorized && daysLeft >= 0,
        validTo: validTo.toISOString(),
        daysLeft,
        issuer,
        error: daysLeft < 0 ? "el certificado está vencido" : authErr,
      });
    });
    socket.on("timeout", () => done({ ok: false, validTo: null, daysLeft: null, issuer: null, error: "el puerto 443 no respondió a tiempo" }));
    socket.on("error", (e: NodeJS.ErrnoException) =>
      done({
        ok: false, validTo: null, daysLeft: null, issuer: null,
        error: e.code === "ECONNREFUSED" ? "el servidor no acepta conexiones seguras (puerto 443 cerrado)" : (HTTP_ERRORS[e.code ?? ""] ?? e.message),
      }),
    );
  });
}

/** Los códigos que devuelve `fetch` al fallar, contados para un cliente. */
const HTTP_ERRORS: Record<string, string> = {
  TimeoutError: "el servidor no respondió a tiempo",
  UND_ERR_CONNECT_TIMEOUT: "el servidor no respondió a tiempo",
  ECONNREFUSED: "el servidor rechazó la conexión (servicio caído)",
  ECONNRESET: "el servidor cortó la conexión",
  UND_ERR_SOCKET: "el servidor cortó la conexión",
  EHOSTUNREACH: "no se puede llegar al servidor",
  ENETUNREACH: "no se puede llegar al servidor",
  CERT_HAS_EXPIRED: "el certificado de seguridad está vencido",
  DEPTH_ZERO_SELF_SIGNED_CERT: "el certificado de seguridad no es de confianza",
  SELF_SIGNED_CERT_IN_CHAIN: "el certificado de seguridad no es de confianza",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "el certificado de seguridad está incompleto",
  ERR_TLS_CERT_ALTNAME_INVALID: "el certificado de seguridad es de otro dominio",
  EPRIVATE: "el sitio apunta o redirige a una dirección interna, que no se comprueba desde aquí",
  ETOOMANYREDIRECTS: "el sitio redirige demasiadas veces (posible bucle de redirecciones)",
};

/** Un fallo de certificado ya lo cuenta la comprobación SSL; no se repite. */
const isCertError = (code: string) => /CERT|SIGNATURE|TLS/.test(code);

const httpError = (code: string) => Object.assign(new Error(code), { code });

/** Una petición, sin seguir redirecciones: devuelve el estado y a dónde manda. */
function requestOnce(url: URL, timeoutMs: number): Promise<{ status: number; location: string | null }> {
  return new Promise((resolve, reject) => {
    // Con una IP escrita tal cual Node no consulta el DNS y `safeLookup` no
    // llega a correr: un `Location: http://127.0.0.1/` se frena aquí.
    const literal = url.hostname.replace(/^\[|\]$/g, "");
    if (net.isIP(literal) && isPrivate(literal)) return reject(httpError("EPRIVATE"));
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        headers: { "User-Agent": "GenioramaSiteCheck/1.0 (+https://app.geniorama.co)" },
        lookup: safeLookup,
        timeout: timeoutMs,
      },
      (res) => {
        // No hace falta el cuerpo; cortarlo libera la conexión.
        res.destroy();
        resolve({ status: res.statusCode ?? 0, location: res.headers.location ?? null });
      },
    );
    req.on("timeout", () => req.destroy(httpError("TimeoutError")));
    req.on("error", reject);
    req.end();
  });
}

/** Sigue las redirecciones a mano: cada salto vuelve a pasar por `safeLookup`. */
async function fetchFollowing(start: URL): Promise<{ status: number; finalUrl: string }> {
  const deadline = Date.now() + TIMEOUT_MS;
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const left = deadline - Date.now();
    if (left <= 0) throw httpError("TimeoutError");
    const { status, location } = await requestOnce(url, left);
    if (status < 300 || status >= 400 || !location) return { status, finalUrl: url.toString() };
    const next = new URL(location, url);
    if (next.protocol !== "https:" && next.protocol !== "http:") return { status, finalUrl: url.toString() };
    url = next;
  }
  throw httpError("ETOOMANYREDIRECTS");
}

async function checkHttp(host: string): Promise<NonNullable<SiteCheck["http"]> & { code: string | null }> {
  for (const scheme of ["https", "http"] as const) {
    // El tiempo se mide por intento: un HTTPS que agota el plazo no debe hacer
    // pasar por lento a un HTTP que responde al instante.
    const started = Date.now();
    try {
      const res = await fetchFollowing(new URL(`${scheme}://${host}/`));
      return { ok: res.status < 400, status: res.status, finalUrl: res.finalUrl, ms: Date.now() - started, error: null, code: null };
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code ?? (e as Error).name;
      // Una dirección interna no mejora por cambiar de esquema.
      // Si HTTPS falla por otra cosa se intenta HTTP: hay sitios que aún no tienen certificado.
      if (scheme === "http" || code === "EPRIVATE") {
        const error = HTTP_ERRORS[code] ?? `no se pudo conectar (${code})`;
        return { ok: false, status: null, finalUrl: null, ms: Date.now() - started, error, code };
      }
    }
  }
  return { ok: false, status: null, finalUrl: null, ms: null, error: "sin respuesta", code: null };
}

export async function checkSite(domain: string): Promise<SiteCheck> {
  const host = hostOf(domain);
  const base = { domain, checkedAt: new Date().toISOString() };
  if (!host) {
    return { ...base, dns: { ok: false, addresses: [], error: "el dominio guardado no es válido" }, ssl: null, http: null, findings: ["El dominio guardado en la ficha del sitio no es válido; hay que revisarlo con el equipo."] };
  }

  const dnsResult = await checkDns(host);
  if (!dnsResult.ok) {
    return {
      ...base, dns: dnsResult, ssl: null, http: null,
      findings: [`El dominio ${host} no resuelve (${dnsResult.error}). Suele deberse a un dominio vencido o a DNS mal configurados.`],
    };
  }
  if (dnsResult.addresses.some(isPrivate)) {
    return {
      ...base, dns: { ...dnsResult, addresses: [] }, ssl: null, http: null,
      findings: ["El dominio apunta a una dirección interna; no se puede comprobar desde aquí. Hay que revisarlo con el equipo."],
    };
  }

  const [ssl, { code: httpCode, ...http }] = await Promise.all([checkSsl(host), checkHttp(host)]);

  const findings: string[] = [];
  if (!http.ok && !(httpCode && isCertError(httpCode) && ssl.error)) {
    findings.push(
      http.status
        ? `El sitio responde con error ${http.status}${http.status >= 500 ? " (falla del servidor o de la aplicación)" : ""}.`
        : `El sitio no responde: ${http.error}.`,
    );
  }
  if (ssl.error) findings.push(`Certificado de seguridad: ${ssl.error}. Los navegadores mostrarán el sitio como no seguro o lo bloquearán.`);
  else if (ssl.daysLeft !== null && ssl.daysLeft <= 14) findings.push(`El certificado de seguridad vence en ${ssl.daysLeft} días.`);
  if (http.ok && http.ms !== null && http.ms > 5_000) findings.push(`El sitio responde, pero lento (${(http.ms / 1000).toFixed(1)} s).`);

  return { ...base, dns: dnsResult, ssl, http, findings };
}
