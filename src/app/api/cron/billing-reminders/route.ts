import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pendiente } from "@/lib/billing/status";
import { planificar, destinatarioDe, type Cobro, type Regla } from "@/lib/billing/reminders/plan";
import { renderPlantilla, aHtml } from "@/lib/billing/reminders/template";
import { enviarPor } from "@/lib/billing/reminders/channels";
import { CHANNEL_LABELS } from "@/lib/billing/reminders/labels";

/**
 * Los recordatorios de cobro del día.
 *
 * Corre una vez cada mañana. Decide con `planificar`, que es puro; aquí solo
 * se lee, se manda y se apunta.
 *
 * Cada envío se guarda **antes de considerarlo hecho** y el índice único
 * parcial de la base impide que una misma regla escriba dos veces al mismo
 * cliente por el mismo cobro. Si el cron se dispara dos veces, la segunda no
 * manda nada.
 */

export const maxDuration = 60;

const TZ = "America/Bogota";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // El día es el de Bogotá, no el del servidor: «a los 3 días» significa tres
  // días para quien cobra.
  const hoy = new Date(`${new Date().toLocaleDateString("en-CA", { timeZone: TZ })}T12:00:00`);

  const reglas = await prisma.billingReminderRule.findMany({
    where: { isActive: true },
    orderBy: { offsetDays: "asc" },
  });

  if (reglas.length === 0) {
    return NextResponse.json({ ok: true, mensaje: "Sin reglas activas", enviados: 0 });
  }

  const cobros = await prisma.billingItem.findMany({
    where: {
      status: { in: ["FACTURADO", "ABONADO"] },
      remindersOff: false,
      invoiceDueDate: { not: null },
    },
    select: {
      id: true, concept: true, status: true, amount: true, paidAmount: true,
      invoiceDueDate: true, invoiceNumber: true, remindersOff: true,
      company: {
        select: {
          name: true,
          contacts: {
            select: {
              id: true, firstName: true, lastName: true, email: true,
              phone: true, isPrimary: true, isActive: true,
            },
          },
        },
      },
    },
  });

  const yaSalidos = await prisma.billingReminder.findMany({
    where: { status: "SENT", billingItemId: { in: cobros.map((c) => c.id) } },
    select: { ruleId: true, billingItemId: true, channel: true },
  });
  const hechos = new Set(yaSalidos.map((r) => `${r.ruleId}|${r.billingItemId}|${r.channel}`));

  const plan = planificar({
    reglas: reglas as Regla[],
    cobros: cobros as unknown as Cobro[],
    hoy,
    yaEnviado: (reglaId, cobroId, canal) => hechos.has(`${reglaId}|${cobroId}|${canal}`),
  });

  const porCobro = new Map(cobros.map((c) => [c.id, c]));
  const porRegla = new Map(reglas.map((r) => [r.id, r]));

  let enviados = 0, omitidos = 0, fallidos = 0;
  const problemas: string[] = [];

  for (const envio of plan) {
    const cobro = porCobro.get(envio.cobroId)!;
    const regla = porRegla.get(envio.reglaId)!;

    const quien = destinatarioDe(cobro.company.contacts);
    if ("motivo" in quien) {
      // No se apunta como enviado: en cuanto alguien marque el contacto
      // principal, el recordatorio saldrá solo al día siguiente.
      omitidos++;
      problemas.push(`${cobro.concept} (${cobro.company.name}): ${quien.motivo}`);
      continue;
    }

    const datos = {
      empresa: cobro.company.name,
      contacto: quien.destinatario.nombre.split(" ")[0],
      concepto: cobro.concept,
      total: cobro.amount,
      pendiente: pendiente(cobro.amount, cobro.paidAmount),
      vencimiento: cobro.invoiceDueDate,
      dias: envio.dias,
      factura: cobro.invoiceNumber,
    };

    const cuerpo = renderPlantilla(regla.body, datos);
    const asunto = renderPlantilla(regla.subject, datos);

    const r = await enviarPor(envio.channel, quien.destinatario, {
      asunto,
      cuerpo: envio.channel === "EMAIL" ? aHtml(cuerpo) : cuerpo,
    });

    await prisma.billingReminder.create({
      data: {
        ruleId: regla.id,
        billingItemId: cobro.id,
        channel: envio.channel,
        status: r.status,
        recipient: r.recipient,
        recipientName: quien.destinatario.nombre,
        // Se guarda el texto plano y no el HTML: es lo que una persona quiere
        // leer meses después al preguntarse qué se le dijo a este cliente.
        body: cuerpo,
        error: r.error,
      },
    });

    if (r.status === "SENT") {
      enviados++;
      // Queda en el hilo del cobro, junto a los soportes: quien lo abra ve que
      // ya se reclamó y por dónde, sin ir a buscarlo a otra pantalla.
      await prisma.comment.create({
        data: {
          entityType: "BILLING",
          entityId: cobro.id,
          body: `Recordatorio automático enviado por ${CHANNEL_LABELS[envio.channel]} a ${quien.destinatario.nombre} <${r.recipient}> — regla «${regla.name}».`,
          authorId: regla.createdById,
          isInternal: true,
        },
      });
    } else if (r.status === "FAILED") {
      fallidos++;
      problemas.push(`${cobro.concept}: ${r.error}`);
    } else {
      omitidos++;
      if (r.error) problemas.push(`${cobro.concept}: ${r.error}`);
    }
  }

  return NextResponse.json({
    ok: true,
    fecha: hoy.toISOString().slice(0, 10),
    previstos: plan.length,
    enviados,
    omitidos,
    fallidos,
    // Acotado: si algo va mal en cien cobros, el log no debe ser el problema.
    problemas: problemas.slice(0, 20),
  });
}
