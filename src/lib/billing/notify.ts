/**
 * Avisos internos de Facturación: cobro nuevo, cambio de estado y abono.
 *
 * Van a quien lleva el módulo (nivel Miembro o más), menos a quien acaba de
 * hacer el cambio. Los destinatarios salen del acceso y no de una lista
 * aparte: el aviso sigue a quien tenga Facturación hoy.
 *
 * El correo sale **siempre**, sin preferencia que lo apague: un cobro que nadie
 * ve es dinero que no se factura. Se espera a que salga —en vez de dejarlo al
 * aire— para que no se pierda si el proceso termina antes; un fallo se anota y
 * no tumba el cambio, que ya está guardado.
 *
 * No va a Google Chat: el canal del equipo no es sitio para importes.
 *
 * Vive aparte de `items.ts` y `move.ts` porque los dos avisan y uno importa al
 * otro.
 */

import { prisma } from "@/lib/prisma";
import type { BillingStatus } from "@/generated/prisma";
import { BILLING_STATUS_LABELS } from "@/lib/billing/status";
import { formatAmount } from "@/lib/money";
import { notifyMany } from "@/lib/notify";
import { sendBillingNoticeEmail } from "@/lib/email";
import { usersWithModule } from "@/lib/access/can";

export type AvisoCobro =
  | { tipo: "creado" }
  | { tipo: "estado"; from: BillingStatus; to: BillingStatus }
  | { tipo: "abono"; amount: number };

const pesos = (n: number) => formatAmount(n) ?? String(n);

export async function avisarFacturacion(
  actor: { id: string; name?: string | null },
  billingItemId: string,
  aviso: AvisoCobro,
): Promise<void> {
  try {
    const destinatarios = (await usersWithModule("FACTURACION", "MIEMBRO")).filter((u) => u.id !== actor.id);
    if (destinatarios.length === 0) return;

    const cobro = await prisma.billingItem.findUnique({
      where: { id: billingItemId },
      select: { concept: true, amount: true, paidAmount: true, status: true, company: { select: { name: true } } },
    });
    if (!cobro) return;

    const autor =
      actor.name ??
      (await prisma.user.findUnique({ where: { id: actor.id }, select: { name: true } }))?.name ??
      "Alguien del equipo";
    const empresa = cobro.company.name;
    const falta = Math.max(0, Math.round(cobro.amount) - Math.round(cobro.paidAmount));
    const estado = BILLING_STATUS_LABELS[cobro.status];

    let type: string;
    let title: string;
    let message: string;
    // Lo que el correo pone bajo el concepto: el dato que cambió.
    let detalle: string;

    if (aviso.tipo === "creado") {
      type = "billing_created";
      title = "Nuevo cobro";
      message = `${autor} creó «${cobro.concept}» para ${empresa} · ${pesos(cobro.amount)}`;
      detalle = `${pesos(cobro.amount)} · ${estado}`;
    } else if (aviso.tipo === "estado") {
      const de = BILLING_STATUS_LABELS[aviso.from];
      const a = BILLING_STATUS_LABELS[aviso.to];
      type = "billing_status";
      title = `Cobro en «${a}»`;
      message = `${autor} pasó «${cobro.concept}» (${empresa}) de «${de}» a «${a}» · ${pesos(cobro.amount)}`;
      detalle = `${pesos(cobro.amount)} · ${de} → ${a}`;
    } else {
      // Un abono puede mover el cobro solo (a «Abonado» o «Pagado»): se dice
      // aquí cómo quedó en vez de mandar un segundo aviso por el estado.
      const queda = falta > 0 ? `falta ${pesos(falta)}` : "queda pagado";
      type = "billing_payment";
      title = "Abono registrado";
      message = `${autor} registró un abono de ${pesos(aviso.amount)} en «${cobro.concept}» (${empresa}) · ${queda}`;
      detalle = `Abono de ${pesos(aviso.amount)} sobre ${pesos(cobro.amount)} · ${queda} · ${estado}`;
    }

    const link = `/facturacion/${billingItemId}`;
    await notifyMany(destinatarios.map((u) => u.id), type, title, message, link, true);

    const url = `${(process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")}${link}`;
    const envios = await Promise.allSettled(
      destinatarios.map((u) =>
        sendBillingNoticeEmail(u, {
          subject: `${title} — ${empresa}: ${cobro.concept}`,
          headline: message,
          concept: cobro.concept,
          company: empresa,
          detail: detalle,
          url,
        }),
      ),
    );
    for (const e of envios) {
      if (e.status === "rejected") console.error("[avisarFacturacion] Error enviando email:", e.reason);
    }
  } catch (err) {
    console.error("[avisarFacturacion]", err);
  }
}
