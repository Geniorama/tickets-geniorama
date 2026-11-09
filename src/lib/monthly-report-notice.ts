/**
 * Aviso al cliente de que su informe mensual ya está publicado (AG·P-5).
 *
 * Aparte de `monthly-reports.ts` a propósito: aquel es puro y lo importan
 * componentes de cliente; este toca la base de datos y el correo.
 */

import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { sendMonthlyReportEmail } from "@/lib/email";
import { reportMonthLabel } from "@/lib/monthly-reports";

/**
 * Notificación en la app y correo con enlace directo a «Informes», para el
 * cliente del ticket (o, sin cliente asignado, para quien lo creó si es
 * cliente). Un fallo del aviso no deshace la subida: se registra y ya.
 */
export async function announceMonthlyReport(ticketId: string, reportMonth: string) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        client: { select: { id: true, name: true, email: true, role: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    const recipient =
      ticket?.client ?? (ticket?.createdBy.role === "CLIENTE" ? ticket.createdBy : null);
    if (!recipient) return;

    const label = reportMonthLabel(reportMonth);
    const base = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
    await notify(
      recipient.id,
      "ticket_report",
      "Informe disponible",
      `Tu informe de ${label} ya está publicado`,
      "/informes",
      true,
    );
    void sendMonthlyReportEmail(recipient, label, `${base}/informes`).catch(console.error);
  } catch (err) {
    console.error("[informe mensual] no se pudo avisar al cliente", err);
  }
}
