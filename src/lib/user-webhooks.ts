import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { notificationCategory } from "@/lib/notification-categories";

const EMOJI: Record<string, string> = {
  ticket_new: "🎫", ticket_assigned: "👤", ticket_status: "🔄", ticket_date_changed: "📅",
  task_new: "📋", task_assigned: "👤", task_status: "🔄", task_completed: "✅", task_date_changed: "📅",
  ticket_comment: "💬", task_comment: "💬", mention: "📣", ticket_overdue: "⚠️", task_overdue: "⚠️",
};

export type WebhookPayload = {
  event: string;
  category: string;
  title: string;
  message: string;
  url: string | null;
  timestamp: string;
  text: string;
};

function buildPayload(
  type: string,
  category: string,
  title: string,
  message: string,
  link: string | undefined,
  timestamp: string
): WebhookPayload {
  const base = process.env.AUTH_URL?.replace(/\/$/, "") ?? "";
  const url = link && base ? `${base}${link}` : link ?? null;
  const emoji = EMOJI[type] ?? "🔔";
  let text = `${emoji} ${title}\n${message}`;
  if (url) text += `\n${url}`;
  return { event: type, category, title, message, url, timestamp, text };
}

/** Entrega un payload a un webhook concreto y registra el resultado. */
async function deliver(
  hook: { id: string; url: string; secret: string | null },
  payload: WebhookPayload
): Promise<void> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Geniorama-Webhooks/1.0",
    "X-Geniorama-Event": payload.event,
  };
  if (hook.secret) {
    const sig = crypto.createHmac("sha256", hook.secret).update(body).digest("hex");
    headers["X-Geniorama-Signature"] = `sha256=${sig}`;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(hook.url, { method: "POST", headers, body, signal: controller.signal });
    clearTimeout(timer);
    await prisma.userWebhook
      .update({
        where: { id: hook.id },
        data: {
          lastStatus: res.status,
          lastError: res.ok ? null : `HTTP ${res.status}`,
          lastSentAt: new Date(),
        },
      })
      .catch(() => {});
  } catch (err) {
    await prisma.userWebhook
      .update({
        where: { id: hook.id },
        data: {
          lastStatus: null,
          lastError: err instanceof Error ? err.message.slice(0, 200) : "Error de red",
          lastSentAt: new Date(),
        },
      })
      .catch(() => {});
  }
}

/**
 * Envía una notificación a los webhooks activos del usuario que estén suscritos
 * a la categoría correspondiente. Fire-and-forget: nunca lanza.
 */
export async function dispatchUserWebhooks(
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  const category = notificationCategory(type);
  if (!category) return;

  let hooks: { id: string; url: string; secret: string | null; events: string[] }[];
  try {
    hooks = await prisma.userWebhook.findMany({
      where: { userId, isActive: true },
      select: { id: true, url: true, secret: true, events: true },
    });
  } catch {
    return;
  }

  const targets = hooks.filter((h) => h.events.includes(category));
  if (targets.length === 0) return;

  const payload = buildPayload(type, category, title, message, link, new Date().toISOString());
  await Promise.all(targets.map((h) => deliver(h, payload)));
}

/** Envía un payload de prueba a un webhook (usado desde la UI). */
export async function sendTestWebhook(hook: {
  id: string;
  url: string;
  secret: string | null;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const payload = buildPayload(
    "ticket_new",
    "tickets",
    "Prueba de webhook",
    "Si recibes este mensaje, tu webhook de Geniorama está configurado correctamente.",
    "/dashboard",
    new Date().toISOString()
  );
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Geniorama-Webhooks/1.0",
    "X-Geniorama-Event": "test",
  };
  if (hook.secret) {
    const sig = crypto.createHmac("sha256", hook.secret).update(body).digest("hex");
    headers["X-Geniorama-Signature"] = `sha256=${sig}`;
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(hook.url, { method: "POST", headers, body, signal: controller.signal });
    clearTimeout(timer);
    await prisma.userWebhook
      .update({
        where: { id: hook.id },
        data: { lastStatus: res.status, lastError: res.ok ? null : `HTTP ${res.status}`, lastSentAt: new Date() },
      })
      .catch(() => {});
    return res.ok ? { ok: true, status: res.status } : { ok: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 200) : "Error de red";
    await prisma.userWebhook
      .update({ where: { id: hook.id }, data: { lastStatus: null, lastError: msg, lastSentAt: new Date() } })
      .catch(() => {});
    return { ok: false, error: msg };
  }
}
