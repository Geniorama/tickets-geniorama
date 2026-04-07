/**
 * Google Chat Incoming Webhooks
 * Los webhooks se almacenan en la tabla app_settings de la BD.
 *
 * Claves usadas:
 *   gchat_webhook_tickets   → ticket_new, ticket_assigned, ticket_status, ticket_overdue
 *   gchat_webhook_tasks     → task_assigned, task_completed, task_overdue
 *   gchat_webhook_comments  → ticket_comment, task_comment
 *   gchat_webhook_mentions  → mention
 */

import { prisma } from "@/lib/prisma";

const EMOJI: Record<string, string> = {
  ticket_new:          "🎫",
  ticket_assigned:     "👤",
  ticket_status:       "🔄",
  ticket_date_changed: "📅",
  task_new:            "📋",
  task_assigned:       "👤",
  task_status:         "🔄",
  task_completed:      "✅",
  task_date_changed:   "📅",
  ticket_comment:      "💬",
  task_comment:        "💬",
  mention:             "📣",
  ticket_overdue:      "⚠️",
  task_overdue:        "⚠️",
};

const SETTING_KEY: Record<string, string> = {
  ticket_new:          "gchat_webhook_tickets",
  ticket_assigned:     "gchat_webhook_tickets",
  ticket_status:       "gchat_webhook_tickets",
  ticket_date_changed: "gchat_webhook_tickets",
  task_new:            "gchat_webhook_tasks",
  task_assigned:       "gchat_webhook_tasks",
  task_status:         "gchat_webhook_tasks",
  task_completed:      "gchat_webhook_tasks",
  task_date_changed:   "gchat_webhook_tasks",
  ticket_comment:      "gchat_webhook_comments",
  task_comment:        "gchat_webhook_comments",
  mention:             "gchat_webhook_mentions",
  ticket_overdue:      "gchat_webhook_tickets",
  task_overdue:        "gchat_webhook_tasks",
};

export async function sendGChatNotification(
  type: string,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  const settingKey = SETTING_KEY[type];
  if (!settingKey) return;

  let webhookUrl: string | undefined;
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: settingKey } });
    webhookUrl = setting?.value || undefined;
  } catch {
    return;
  }

  if (!webhookUrl) return;

  const emoji = EMOJI[type] ?? "🔔";
  const base = process.env.AUTH_URL?.replace(/\/$/, "") ?? "";

  let text = `${emoji} *${title}*\n${message}`;
  if (link && base) text += `\n${base}${link}`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    // No bloquear el flujo principal
  }
}
