/**
 * Envío de notificaciones por WhatsApp a través de Zoho CPaaS.
 *
 * Es un canal más de `notify()`, como el push: cada aviso que ya existe sale
 * por aquí si su tipo tiene plantilla y quien lo recibe lo activó. Nada de esto
 * bloquea ni rompe la acción que avisa — si Zoho no responde, el ticket se
 * guarda igual y el error queda en el log.
 *
 *   POST {base}/v1.1/whatsapp
 *   Authorization: Zoho-enczapikey <clave>
 *   { from, to, template_key, merge_info }
 *
 * La clave va en el entorno (`ZOHO_CPAAS_WHATSAPP_TOKEN`), no en la base: es un
 * secreto. Si no está, se usa `ZEPTOMAIL_TOKEN`, porque ZeptoMail pasó a ser
 * Zoho CPaaS y el formato de la clave es el mismo.
 */

import { prisma } from "@/lib/prisma";
import { notificationCategory } from "@/lib/notification-categories";
import {
  WHATSAPP_EVENT_BY_TYPE, WHATSAPP_FROM_KEY, WHATSAPP_SETTING_KEYS,
} from "@/lib/whatsapp/config";

const API_BASE = (process.env.ZOHO_CPAAS_API_URL ?? "https://cpaas.zoho.com").replace(/\/$/, "");

function authHeader(): string | null {
  const raw = (process.env.ZOHO_CPAAS_WHATSAPP_TOKEN ?? process.env.ZEPTOMAIL_TOKEN ?? "").trim();
  if (!raw) return null;
  return /^Zoho-enczapikey\s/i.test(raw) ? raw : `Zoho-enczapikey ${raw}`;
}

export function whatsappTokenConfigured(): boolean {
  return authHeader() !== null;
}

/**
 * El número como lo quiere la pasarela: indicativo y dígitos, sin `+`. En la
 * base se guarda en E.164 (`+573001234567`); si Zoho pidiera otra forma, este
 * es el único sitio que hay que tocar.
 */
function wireNumber(e164: string): string {
  return e164.replace(/[^\d]/g, "");
}

export type SendResult = { ok: true; messageId: string | null } | { ok: false; error: string };

export async function sendWhatsAppTemplate(input: {
  from: string;
  to: string;
  templateKey: string;
  mergeInfo: Record<string, string>;
}): Promise<SendResult> {
  const auth = authHeader();
  if (!auth) return { ok: false, error: "Falta la clave de Zoho CPaaS en el servidor (ZOHO_CPAAS_WHATSAPP_TOKEN)." };

  try {
    const res = await fetch(`${API_BASE}/v1.1/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: auth },
      body: JSON.stringify({
        from: wireNumber(input.from),
        to: wireNumber(input.to),
        template_key: input.templateKey,
        merge_info: input.mergeInfo,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* respuesta no JSON: se devuelve tal cual */ }

    if (!res.ok) {
      // Se devuelve lo que diga Zoho, recortado: es lo único que permite saber
      // si falló la plantilla, el número o la clave.
      return { ok: false, error: `Zoho CPaaS respondió ${res.status}: ${text.slice(0, 400)}` };
    }

    const data = (json as { data?: unknown } | null)?.data;
    const first = Array.isArray(data) ? data[0] : data;
    const messageId = (first as { message_id?: unknown } | undefined)?.message_id;
    return { ok: true, messageId: typeof messageId === "string" ? messageId : null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "No se pudo contactar con Zoho CPaaS" };
  }
}

// ─── Configuración ───────────────────────────────────────────────────────────

export type WhatsAppSettings = { from: string | null; templates: Record<string, string> };

/** Número emisor y clave de plantilla por tipo de aviso. */
export async function getWhatsAppSettings(): Promise<WhatsAppSettings> {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: WHATSAPP_SETTING_KEYS } } });
  const byKey = new Map(rows.map((r) => [r.key, r.value.trim()]));
  const templates: Record<string, string> = {};
  for (const event of WHATSAPP_EVENT_BY_TYPE.values()) {
    const key = byKey.get(event.settingKey);
    if (key) templates[event.type] = key;
  }
  return { from: byKey.get(WHATSAPP_FROM_KEY) || null, templates };
}

function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] || "hola";
}

function absoluteUrl(link: string | undefined): string {
  const base = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (!link) return base;
  return /^https?:\/\//.test(link) ? link : `${base}${link.startsWith("/") ? "" : "/"}${link}`;
}

/**
 * Las variables de una plantilla no admiten saltos de línea ni tabuladores, ni
 * más de cuatro espacios seguidos: Meta rechaza el envío entero.
 */
function clean(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim().slice(0, 900);
}

// ─── Despacho ────────────────────────────────────────────────────────────────

/**
 * Manda por WhatsApp una notificación a quienes la reciben y lo tienen
 * activado. Nunca lanza: está pensado para llamarse sin esperar.
 */
export async function dispatchWhatsApp(
  userIds: string[],
  type: string,
  message: string,
  link?: string,
): Promise<void> {
  try {
    if (userIds.length === 0 || !WHATSAPP_EVENT_BY_TYPE.has(type)) return;

    const settings = await getWhatsAppSettings();
    const templateKey = settings.templates[type];
    if (!settings.from || !templateKey) return;

    const category = notificationCategory(type);
    const users = await prisma.user.findMany({
      where: {
        id: { in: [...new Set(userIds)] },
        isActive: true,
        whatsappEnabled: true,
        whatsappPhone: { not: null },
        ...(category ? { whatsappEvents: { has: category } } : {}),
      },
      select: { id: true, name: true, whatsappPhone: true },
    });

    await Promise.all(
      users.map(async (user) => {
        const result = await sendWhatsAppTemplate({
          from: settings.from!,
          to: user.whatsappPhone!,
          templateKey,
          mergeInfo: { nombre: firstName(user.name), detalle: clean(message), enlace: absoluteUrl(link) },
        });
        if (!result.ok) console.error(`[whatsapp] ${type} → ${user.id}: ${result.error}`);
      }),
    );
  } catch (err) {
    console.error("[whatsapp]", err);
  }
}

/**
 * Al cliente, cuando su ticket recibe un agente. Es el equivalente por
 * WhatsApp del correo «tu ticket fue asignado»; no crea notificación en la
 * campana (el cliente no la recibía y esto no lo cambia).
 */
export async function dispatchTicketAgentAssigned(ticketId: string, agentId: string): Promise<void> {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { title: true, clientId: true, isDraft: true },
    });
    if (!ticket?.clientId || ticket.isDraft || ticket.clientId === agentId) return;

    const agent = await prisma.user.findUnique({ where: { id: agentId }, select: { name: true } });
    const quien = agent?.name ? `${agent.name} está a cargo de` : "Ya hay alguien a cargo de";
    await dispatchWhatsApp(
      [ticket.clientId],
      "ticket_agent_assigned",
      `${quien} "${ticket.title}".`,
      `/tickets/${ticketId}`,
    );
  } catch (err) {
    console.error("[whatsapp]", err);
  }
}
