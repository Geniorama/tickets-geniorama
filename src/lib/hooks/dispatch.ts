/**
 * Envío de eventos a los hooks suscritos.
 *
 * Desde el historial de acciones, los atajos del final del archivo hacen dos
 * cosas con el mismo hecho: lo guardan en `activity_log` y lo cuentan a los
 * hooks. Ver la nota de la sección «Atajos por recurso» para el porqué.
 *
 * Reglas que se sostienen desde aquí:
 *
 *   · **Nunca lanza.** Un destino caído no puede tumbar la acción que lo
 *     originó: crear un ticket no depende de que n8n conteste.
 *   · **No cuesta si nadie escucha.** Primero se buscan suscriptores y solo
 *     entonces se arma el payload, que implica consultar la entidad. Sin hooks
 *     configurados, el coste de todo esto es una consulta indexada.
 *   · **Los proyectos privados no salen de su proyecto.** Sus eventos llegan
 *     únicamente a hooks con `scope = PROJECT` apuntando a ese proyecto, nunca
 *     a los de organización — el mismo criterio que ya aplicaba el canal de
 *     equipo en Google Chat.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { EntityType } from "@/generated/prisma";
import { recordActivity } from "@/lib/activity/record";
import { entityLabel } from "@/lib/activity/label";
import type { HookEvent } from "@/lib/hooks/events";
import {
  APP_URL,
  accountPayload,
  activityPayload,
  commentPayload,
  contactPayload,
  dealPayload,
  projectPayload,
  taskPayload,
  ticketPayload,
} from "@/lib/hooks/payload";

/** Un destino lento no puede quedarse con una conexión abierta para siempre. */
const TIMEOUT_MS = 8000;
/** Un reintento y no más: si el destino falla dos veces, el problema es suyo. */
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;
/** Cuánto se conserva el historial de entregas. */
const DELIVERY_RETENTION_DAYS = 14;

/**
 * Quién provocó el evento.
 *
 * `name` se acepta opcional porque la sesión de NextAuth lo declara así; se
 * normaliza al armar el payload en vez de obligar a cada llamada a hacerlo.
 */
export type HookActor = { id: string; name?: string | null } | null | undefined;

export type HookChanges = Record<string, { from: unknown; to: unknown }>;

type HookRow = {
  id: string;
  url: string;
  secret: string;
};

export type HookPayload = {
  id: string;
  event: string;
  occurredAt: string;
  actor: { id: string; name: string } | null;
  changes?: HookChanges;
  data: unknown;
};

// ─── Suscriptores ────────────────────────────────────────────────────────────

async function findSubscribers(
  event: string,
  projectId: string | null,
  projectIsPrivate: boolean,
): Promise<HookRow[]> {
  const scoped = { scope: "PROJECT" as const, projectId: projectId ?? undefined };

  const where =
    projectId && projectIsPrivate
      ? { isActive: true, events: { has: event }, ...scoped }
      : projectId
        ? {
            isActive: true,
            events: { has: event },
            OR: [{ scope: "ORG" as const }, scoped],
          }
        : { isActive: true, events: { has: event }, scope: "ORG" as const };

  try {
    return await prisma.hook.findMany({
      where,
      select: { id: true, url: true, secret: true },
    });
  } catch {
    return [];
  }
}

// ─── Entrega ─────────────────────────────────────────────────────────────────

function sign(secret: string, body: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

function newDeliveryId(): string {
  return `evt_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function post(
  hook: HookRow,
  payload: HookPayload,
): Promise<{ status: number | null; error: string | null; attempts: number; durationMs: number }> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Geniorama-Hooks/1.0",
    "X-Geniorama-Event": payload.event,
    "X-Geniorama-Delivery": payload.id,
    "X-Geniorama-Timestamp": payload.occurredAt,
    "X-Geniorama-Signature": sign(hook.secret, body),
  };

  const startedAt = Date.now();
  let status: number | null = null;
  let error: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(hook.url, { method: "POST", headers, body, signal: controller.signal });
      clearTimeout(timer);

      status = res.status;
      error = res.ok ? null : `HTTP ${res.status}`;

      // Un 4xx es una decisión del destino (payload que no le gusta, ruta que
      // ya no existe): reintentarlo solo repite el rechazo. Un 5xx sí puede ser
      // pasajero.
      if (res.ok || res.status < 500) {
        return { status, error, attempts: attempt, durationMs: Date.now() - startedAt };
      }
    } catch (err) {
      status = null;
      error = err instanceof Error ? err.message.slice(0, 200) : "Error de red";
    }

    if (attempt < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  return { status, error, attempts: MAX_ATTEMPTS, durationMs: Date.now() - startedAt };
}

async function record(
  hook: HookRow,
  payload: HookPayload,
  result: { status: number | null; error: string | null; attempts: number; durationMs: number },
): Promise<void> {
  try {
    await prisma.$transaction([
      prisma.hookDelivery.create({
        data: {
          id: payload.id,
          hookId: hook.id,
          event: payload.event,
          payload: payload as never,
          status: result.status,
          error: result.error,
          durationMs: result.durationMs,
          attempts: result.attempts,
        },
      }),
      prisma.hook.update({
        where: { id: hook.id },
        data: {
          lastStatus: result.status,
          lastError: result.error,
          lastSentAt: new Date(),
        },
      }),
    ]);
  } catch {
    // El historial es diagnóstico, no parte del contrato: si falla, el evento
    // ya se entregó igual.
    return;
  }

  // Poda perezosa: una de cada diez entregas limpia lo viejo de su hook. Basta
  // para que la tabla no crezca sin fin y no añade una consulta a cada evento.
  if (Math.random() < 0.1) {
    const cutoff = new Date(Date.now() - DELIVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await prisma.hookDelivery
      .deleteMany({ where: { hookId: hook.id, createdAt: { lt: cutoff } } })
      .catch(() => {});
  }
}

// ─── API interna ─────────────────────────────────────────────────────────────

type EmitInput = {
  event: HookEvent;
  /** Proyecto al que pertenece el evento, si cuelga de alguno. */
  projectId?: string | null;
  projectIsPrivate?: boolean;
  actor?: HookActor;
  changes?: HookChanges;
  /** Datos ya resueltos (borrados: la entidad ya no existe para consultarla). */
  data?: unknown;
  /** Cargador perezoso: solo corre si hay alguien suscrito. */
  load?: () => Promise<unknown>;
};

/**
 * Cuenta un evento a quien esté escuchando. Fire-and-forget: no se espera.
 */
export async function emitHook(input: EmitInput): Promise<void> {
  try {
    const hooks = await findSubscribers(
      input.event,
      input.projectId ?? null,
      input.projectIsPrivate ?? false,
    );
    if (hooks.length === 0) return;

    const data = input.data ?? (input.load ? await input.load() : null);
    if (data === null || data === undefined) return;

    const base = {
      event: input.event,
      occurredAt: new Date().toISOString(),
      actor: input.actor ? { id: input.actor.id, name: input.actor.name ?? "Sistema" } : null,
      ...(input.changes && Object.keys(input.changes).length > 0 ? { changes: input.changes } : {}),
      data,
    };

    await Promise.all(
      hooks.map(async (hook) => {
        // Cada destino lleva su propio id de entrega: así el receptor puede
        // descartar duplicados sin confundir su copia con la del vecino.
        const payload: HookPayload = { id: newDeliveryId(), ...base };
        const result = await post(hook, payload);
        await record(hook, payload, result);
      }),
    );
  } catch (err) {
    console.error("[hooks] Error despachando evento:", err);
  }
}

// ─── Atajos por recurso ──────────────────────────────────────────────────────
//
// Las acciones de la plataforma llaman a estos y no a `emitHook` directamente:
// una línea por evento, sin repetir en cada sitio cómo se arma un payload.
//
// Desde el historial de acciones, un atajo hace dos cosas con el mismo hecho:
// lo **guarda hacia adentro** en `activity_log` y lo **cuenta hacia afuera** a
// los hooks suscritos. Están juntos porque el sitio que provoca las dos es el
// mismo, y separarlos garantizaría que tarde o temprano una acción emita sin
// registrar. Lo que no tiene hooks —facturación, administración— llama a
// `recordActivity()` por su cuenta.
//
// El historial no depende de que haya suscriptores: `emitHook` se corta pronto
// si nadie escucha, y por eso el registro va antes y aparte.

/** Guarda el hecho en el historial resolviendo el nombre de la ficha. */
function logToHistory(
  entityType: EntityType,
  entityId: string,
  event: string,
  opts: { actor?: HookActor; changes?: HookChanges },
): void {
  // Una edición sin campos vigilados la descartaría `recordActivity` de todas
  // formas; cortar aquí ahorra además ir a buscar un nombre que no se va a
  // usar, y esa consulta la pagaría cada guardado de cada ficha.
  const vacio = !opts.changes || Object.keys(opts.changes).length === 0;
  if (vacio && event.endsWith(".updated")) return;

  void (async () => {
    recordActivity({
      entityType,
      entityId,
      action: event,
      label: await entityLabel(entityType, entityId),
      changes: opts.changes,
      actor: opts.actor,
    });
  })();
}

export function emitTicketHook(
  event: HookEvent,
  ticketId: string,
  opts: { actor?: HookActor; changes?: HookChanges } = {},
): void {
  logToHistory("TICKET", ticketId, event, opts);
  void emitHook({ event, actor: opts.actor, changes: opts.changes, load: () => ticketPayload(ticketId) });
}

export function emitTaskHook(
  event: HookEvent,
  taskId: string,
  opts: { actor?: HookActor; changes?: HookChanges; projectId?: string | null; projectIsPrivate?: boolean } = {},
): void {
  logToHistory("TASK", taskId, event, opts);
  void (async () => {
    let projectId = opts.projectId ?? null;
    let isPrivate = opts.projectIsPrivate;

    if (isPrivate === undefined) {
      const task = await prisma.task
        .findUnique({ where: { id: taskId }, select: { project: { select: { id: true, isPrivate: true } } } })
        .catch(() => null);
      projectId = task?.project?.id ?? projectId;
      isPrivate = task?.project?.isPrivate ?? false;
    }

    await emitHook({
      event,
      projectId,
      projectIsPrivate: isPrivate,
      actor: opts.actor,
      changes: opts.changes,
      load: () => taskPayload(taskId),
    });
  })();
}

export function emitProjectHook(
  event: HookEvent,
  projectId: string,
  opts: { actor?: HookActor; changes?: HookChanges; isPrivate?: boolean; data?: unknown } = {},
): void {
  logToHistory("PROJECT", projectId, event, opts);
  void emitHook({
    event,
    projectId,
    projectIsPrivate: opts.isPrivate ?? false,
    actor: opts.actor,
    changes: opts.changes,
    data: opts.data,
    load: opts.data ? undefined : () => projectPayload(projectId),
  });
}

/**
 * Un comentario resuelve su proyecto solo: cuelga de una tarea, de un ticket o
 * de un proyecto, y el alcance depende de dónde cayó.
 */
export function emitCommentHook(commentId: string, opts: { actor?: HookActor } = {}): void {
  void (async () => {
    const resolved = await commentPayload(commentId).catch(() => null);
    if (!resolved) return;

    // Las notas internas del equipo no salen de la plataforma: si un cliente no
    // las ve en el hilo, tampoco deben aparecer en un canal externo.
    const data = resolved.payload as { isInternal?: boolean };
    if (data.isInternal) return;

    let isPrivate = false;
    if (resolved.projectId) {
      const project = await prisma.project
        .findUnique({ where: { id: resolved.projectId }, select: { isPrivate: true } })
        .catch(() => null);
      isPrivate = project?.isPrivate ?? false;
    }

    await emitHook({
      event: "comment.created",
      projectId: resolved.projectId,
      projectIsPrivate: isPrivate,
      actor: opts.actor,
      data: resolved.payload,
    });
  })();
}

// ─── CRM ─────────────────────────────────────────────────────────────────────
//
// Nada del CRM cuelga de un proyecto, así que estos eventos van siempre a los
// hooks de organización: no se pasa `projectId`.

export function emitAccountHook(
  event: HookEvent,
  accountId: string,
  opts: { actor?: HookActor; changes?: HookChanges } = {},
): void {
  logToHistory("COMPANY", accountId, event, opts);
  void emitHook({ event, actor: opts.actor, changes: opts.changes, load: () => accountPayload(accountId) });
}

export function emitContactHook(
  event: HookEvent,
  contactId: string,
  opts: { actor?: HookActor; changes?: HookChanges } = {},
): void {
  logToHistory("CONTACT", contactId, event, opts);
  void emitHook({ event, actor: opts.actor, changes: opts.changes, load: () => contactPayload(contactId) });
}

export function emitDealHook(
  event: HookEvent,
  dealId: string,
  opts: { actor?: HookActor; changes?: HookChanges } = {},
): void {
  logToHistory("DEAL", dealId, event, opts);
  void emitHook({ event, actor: opts.actor, changes: opts.changes, load: () => dealPayload(dealId) });
}

export function emitActivityHook(activityId: string, opts: { actor?: HookActor } = {}): void {
  // Una interacción del CRM se registra sobre su cuenta y no sobre sí misma:
  // nadie abre la ficha de una llamada, se lee en el historial de la empresa.
  void (async () => {
    const row = await prisma.crmActivity
      .findUnique({ where: { id: activityId }, select: { companyId: true, summary: true, type: true } })
      .catch(() => null);
    if (row) {
      recordActivity({
        entityType: "COMPANY",
        entityId: row.companyId,
        action: "activity.logged",
        label: await entityLabel("COMPANY", row.companyId),
        meta: { note: row.summary },
        actor: opts.actor,
      });
    }
  })();

  void emitHook({ event: "activity.logged", actor: opts.actor, load: () => activityPayload(activityId) });
}

/**
 * Cerrar una oportunidad manda dos eventos: el cambio de etapa, que interesa a
 * quien sigue el pipeline entero, y `deal.won` / `deal.lost`, que es lo que se
 * engancha a facturación o a un canal de avisos sin tener que filtrar por etapa
 * del otro lado.
 */
export function emitDealStageHooks(
  dealId: string,
  from: string,
  to: string,
  opts: { actor?: HookActor } = {},
): void {
  if (from === to) return;

  emitDealHook("deal.stage_changed", dealId, {
    actor: opts.actor,
    changes: { stage: { from, to } },
  });

  if (to === "GANADA") emitDealHook("deal.won", dealId, { actor: opts.actor });
  if (to === "PERDIDA") emitDealHook("deal.lost", dealId, { actor: opts.actor });
}

/**
 * Eventos de borrado: la entidad ya no existe, así que el payload viaja hecho.
 *
 * Para el historial hay que decir aparte qué se borró (`entity`), porque el
 * nombre ya no se puede ir a buscar: es el único caso donde el registro no
 * puede resolver la ficha por su cuenta, y justo el que más se consulta.
 */
export function emitDeletedHook(
  event: HookEvent,
  data: unknown,
  opts: {
    actor?: HookActor;
    projectId?: string | null;
    projectIsPrivate?: boolean;
    entity?: { type: EntityType; id: string; label?: string | null };
  } = {},
): void {
  if (opts.entity) {
    recordActivity({
      entityType: opts.entity.type,
      entityId: opts.entity.id,
      action: event,
      label: opts.entity.label ?? null,
      actor: opts.actor,
    });
  }

  void emitHook({
    event,
    data,
    actor: opts.actor,
    projectId: opts.projectId ?? null,
    projectIsPrivate: opts.projectIsPrivate ?? false,
  });
}

// ─── Prueba desde la interfaz ────────────────────────────────────────────────

/** Manda un evento de ejemplo a un hook concreto y devuelve qué contestó. */
export async function sendTestHook(hook: {
  id: string;
  url: string;
  secret: string;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const payload: HookPayload = {
    id: newDeliveryId(),
    event: "ping",
    occurredAt: new Date().toISOString(),
    actor: null,
    data: {
      message: "Si ves esto, tu hook de Geniorama está bien conectado.",
      url: `${APP_URL}/admin/integraciones`,
    },
  };

  const result = await post(hook, payload);
  await record(hook, payload, result);

  if (result.error) return { ok: false, status: result.status ?? undefined, error: result.error };
  return { ok: true, status: result.status ?? undefined };
}
