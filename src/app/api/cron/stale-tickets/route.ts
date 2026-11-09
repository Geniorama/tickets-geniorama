import { NextRequest, NextResponse } from "next/server";
import { findStaleTickets, STALE_DAYS } from "@/lib/stale-tickets";
import { notify } from "@/lib/notify";
import { sendGChatNotification } from "@/lib/gchat";
import { ticketCode } from "@/lib/ticket-code";

export const maxDuration = 30;

const MAX_IN_CHAT = 10;
const STATUS_LABEL: Record<string, string> = { ABIERTO: "Abierto", EN_PROGRESO: "En progreso" };

/**
 * Aviso de tickets sin movimiento (AG·P-6).
 *
 * Un solo mensaje al canal con los más quietos, y un aviso por responsable con
 * *sus* tickets: no uno por ticket, que cada mañana sería ruido. Lo que no tiene
 * responsable solo sale en el canal, porque nadie en concreto lo recibiría.
 *
 * Lo lanza el workflow `cron-sin-movimiento.yml` de lunes a viernes.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stale = await findStaleTickets({ days: STALE_DAYS });
  if (stale.length === 0) return NextResponse.json({ ok: true, stale: 0, notified: 0 });

  // ── Canal ──────────────────────────────────────────────────────────────
  const lines = stale.slice(0, MAX_IN_CHAT).map((t) => {
    const who = t.assignedTo?.name ?? "Sin asignar";
    return `• ${ticketCode(t.prefix, t.number)} "${t.title}" · ${STATUS_LABEL[t.status] ?? t.status} · ${t.daysIdle} d quieto · 👤 ${who}`;
  });
  const more = stale.length > MAX_IN_CHAT ? `\n…y ${stale.length - MAX_IN_CHAT} más.` : "";
  await sendGChatNotification(
    "ticket_stale",
    `${stale.length} ${stale.length === 1 ? "ticket sin movimiento" : "tickets sin movimiento"} (más de ${STALE_DAYS} días)`,
    lines.join("\n") + more,
    "/tickets?stale=1",
  );

  // ── Un aviso por responsable ───────────────────────────────────────────
  const byUser = new Map<string, typeof stale>();
  for (const t of stale) {
    if (!t.assignedTo) continue;
    byUser.set(t.assignedTo.id, [...(byUser.get(t.assignedTo.id) ?? []), t]);
  }
  for (const [userId, list] of byUser) {
    const worst = list[0];
    const text =
      list.length === 1
        ? `"${worst.title}" lleva ${worst.daysIdle} días sin movimiento.`
        : `Tienes ${list.length} tickets sin movimiento; el más quieto, "${worst.title}", lleva ${worst.daysIdle} días.`;
    await notify(
      userId,
      "ticket_stale",
      list.length === 1 ? "Ticket sin movimiento" : "Tickets sin movimiento",
      text,
      list.length === 1 ? `/tickets/${worst.id}` : "/tickets?stale=1",
      true, // el canal ya recibió el resumen: no repetirlo por responsable
    );
  }

  return NextResponse.json({ ok: true, stale: stale.length, notified: byUser.size });
}
