import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { entregar, tomar } from "@/lib/billing/emails/send";

/**
 * Los correos de facturación programados a los que ya les llegó la hora.
 *
 * Corre cada hora. No decide nada: quién recibe qué lo dejó escrito la persona
 * que programó cada correo; aquí solo se recoge lo vencido y se saca.
 *
 * Cada correo se **toma** antes de enviarlo (`tomar`), así que un doble
 * disparo del cron no manda nada dos veces. Lo que no salió una hora —el
 * servidor caído, la red— sigue PROGRAMADO y sale en la siguiente pasada.
 */

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const vencidos = await prisma.billingEmail.findMany({
    where: { status: "PROGRAMADO", scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: "asc" },
    // Acotado para caber en `maxDuration`. Lo que sobre sale en la siguiente.
    take: 50,
    select: { id: true, billingItem: { select: { concept: true } } },
  });

  let enviados = 0, omitidos = 0, fallidos = 0;
  const problemas: string[] = [];

  for (const correo of vencidos) {
    if (!(await tomar(correo.id))) continue;

    const r = await entregar(correo.id);
    if (r.status === "ENVIADO") {
      enviados++;
    } else {
      if (r.status === "OMITIDO") omitidos++;
      else fallidos++;
      problemas.push(`${correo.billingItem.concept}: ${r.error}`);
    }
  }

  return NextResponse.json({
    ok: true,
    previstos: vencidos.length,
    enviados,
    omitidos,
    fallidos,
    problemas: problemas.slice(0, 20),
  });
}
