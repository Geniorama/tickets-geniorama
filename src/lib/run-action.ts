/**
 * Llamar a un Server Action desde el cliente sin que el botón se quede pegado.
 *
 * Por qué existe: un Server Action no se puede cancelar y, además, Next los
 * ejecuta de uno en uno por navegador. Si una respuesta no llega (red que se
 * cae, Cloudflare, un despliegue a medias), el `await` no termina nunca, la
 * transición sigue «pendiente» y el botón queda en «Enviando…» para siempre.
 *
 * `runAction` pone un tope de tiempo y convierte cualquier fallo en un mensaje
 * legible, así que el que llama siempre recupera el control:
 *
 *   startTransition(async () => {
 *     const r = await runAction(() => addComment(id, formData), { timeoutMs: 60_000 });
 *     if (!r.ok) return setError(r.error);
 *     if (r.data?.error) return setError(r.data.error);
 *     ...
 *   });
 *
 * Importante: pasado el tiempo el servidor puede haber terminado igual. Por eso
 * el mensaje de `timedOut` pide comprobar antes de reintentar, para no duplicar
 * un comentario o un cobro.
 */

import { unstable_rethrow } from "next/navigation";

export type ActionOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; timedOut?: boolean };

export const ACTION_TIMEOUT_MS = 30_000;

export const MSG_TIMEOUT =
  "Está tardando más de lo normal. Es posible que ya se haya guardado: recarga la página para comprobarlo antes de volver a intentarlo.";
export const MSG_NETWORK = "No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.";
export const MSG_STALE =
  "La aplicación se actualizó mientras estabas aquí. Recarga la página para continuar.";
export const MSG_GENERIC = "No se pudo completar la acción. Intenta de nuevo en unos segundos.";

function describe(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  // Tras un despliegue, la pestaña abierta conserva ids de acciones que ya no existen.
  if (/failed to find server action|older or newer deployment/i.test(msg)) return MSG_STALE;
  if (/failed to fetch|networkerror|load failed|network|fetch failed|unexpected response/i.test(msg)) {
    return MSG_NETWORK;
  }
  return MSG_GENERIC;
}

export async function runAction<T>(
  fn: () => Promise<T>,
  { timeoutMs = ACTION_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<ActionOutcome<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  try {
    const winner = await Promise.race([fn(), timeout]);
    if (winner === "timeout") return { ok: false, error: MSG_TIMEOUT, timedOut: true };
    return { ok: true, data: winner as T };
  } catch (err) {
    // Un redirect()/notFound() del servidor viaja como excepción: no es un fallo.
    unstable_rethrow(err);
    console.error("[runAction]", err);
    return { ok: false, error: describe(err) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Claves de un resultado de acción (objetos); vacío para arrays, void, etc. */
type KeysOf<T> = T extends readonly unknown[] ? never : T extends object ? keyof T : never;

/** Lo que devuelve `callAction` cuando falla: `{ error }` y el resto de claves vacías. */
export type ActionFailure<T> = { error: string } & {
  [K in Exclude<KeysOf<T>, "error">]?: undefined;
};

/**
 * Igual que `runAction`, pero devuelve lo mismo que el Server Action: si algo
 * falla (tiempo, red, despliegue nuevo) devuelve `{ error }`, que es la forma
 * en que estas acciones ya informan de sus errores. Así se puede cambiar
 * `await accion(...)` por `await callAction(() => accion(...))` sin tocar el
 * resto del manejador.
 *
 * Si la acción devuelve algo que no es un objeto con `error` (una lista, un
 * número…), usa `runAction`, que distingue éxito de fallo sin mezclar tipos.
 */
export async function callAction<T>(
  fn: () => Promise<T>,
  opts?: { timeoutMs?: number },
): Promise<T | ActionFailure<T>> {
  const r = await runAction(fn, opts);
  return r.ok ? r.data : ({ error: r.error } as ActionFailure<T>);
}

/** Evento que escucha <ActionToaster /> para mostrar el aviso. */
export const ACTION_ERROR_EVENT = "app:action-error";

export function notifyActionError(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ACTION_ERROR_EVENT, { detail: message }));
}

/**
 * Para acciones cuyo resultado nadie espera (pausar un timer, borrar, reordenar):
 * si fallan, o devuelven un `{ error }`, se muestra un aviso en pantalla en vez
 * de dejar la interfaz como si hubiera funcionado.
 */
export async function fireAction<T>(
  fn: () => Promise<T>,
  opts?: { timeoutMs?: number },
): Promise<T | undefined> {
  const r = await runAction(fn, opts);
  if (!r.ok) {
    notifyActionError(r.error);
    return undefined;
  }
  const err = (r.data as { error?: unknown } | undefined | null)?.error;
  if (typeof err === "string" && err) notifyActionError(err);
  return r.data;
}
