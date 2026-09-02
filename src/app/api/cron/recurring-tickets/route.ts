/**
 * Barrido diario de tickets recurrentes.
 *
 * Gemelo de `/api/cron/recurring-tasks`. Va aparte y no dentro de aquel porque
 * un endpoint llamado «recurring-tasks» que además abriera tickets sería un
 * nombre que miente, y porque si un mantenimiento falla no debe arrastrar
 * consigo la generación de las tareas del día. El workflow llama a los dos.
 *
 * Lo pesado —crear el ticket, avanzar la programación, avisar— vive en
 * `lib/recurring-tickets.ts`, compartido con el botón «Generar ahora».
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generarTicketRecurrente, avisarTicketRecurrente } from "@/lib/recurring-tickets";

export const maxDuration = 30;

/** Un barrido no puede quedarse colgado generando mil tickets de golpe. */
const MAX_POR_BARRIDO = 200;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();

  const templates = await prisma.recurringTicketTemplate.findMany({
    where: {
      isActive: true,
      nextRunAt: { lte: now },
      // Una recurrencia con fecha de fin pasada ya no abre nada, pero se
      // conserva: su historial y los tickets que generó siguen colgando de ella.
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    take: MAX_POR_BARRIDO,
    include: { assignedTo: { select: { name: true } } },
  });

  let generated = 0;
  const errors: { id: string; message: string }[] = [];

  for (const tpl of templates) {
    try {
      const ticket = await generarTicketRecurrente(tpl, tpl.createdById, { ahora: now });
      generated++;

      // Los avisos van después de que la transacción confirme y no tumban el
      // barrido si fallan: un correo caído no puede impedir que se generen los
      // mantenimientos de los demás clientes.
      const autor = await prisma.user
        .findUnique({ where: { id: tpl.createdById }, select: { name: true } })
        .catch(() => null);

      await avisarTicketRecurrente(tpl, ticket, autor?.name ?? "La plataforma").catch(() => {});
    } catch (e) {
      errors.push({ id: tpl.id, message: e instanceof Error ? e.message : "Error desconocido" });
    }
  }

  return NextResponse.json({ ok: true, candidates: templates.length, generated, errors });
}
