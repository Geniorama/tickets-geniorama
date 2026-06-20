/**
 * Recalcula `nextRunAt` de las plantillas recurrentes para alinearlo con la
 * cadencia real (la misma que muestra la vista previa del formulario y usa el
 * cron). Corrige plantillas cuyo `nextRunAt` quedó desviado por el antiguo
 * `runRecurringNow`, que lo anclaba a `now` (con hora del día) en vez de
 * encadenar desde la fecha programada a las 00:00.
 *
 * Canónico = primera ocurrencia de la cadena que arranca en `startDate` (00:00
 * UTC) y avanza con `computeNextRunAt`, tomando la primera que sea estrictamente
 * posterior a `lastRunAt`. Si nunca se ejecutó, el canónico es `startDate`.
 * NO se salta ocurrencias vencidas: si una plantilla está atrasada (su próxima
 * fecha ya pasó pero el cron aún no la generó) se respeta, para no perder esa
 * generación pendiente.
 *
 * TZ=UTC: forzamos UTC para que el cálculo de día-de-semana / día-de-mes coincida
 * con el servidor (que corre en UTC), no con la zona local de quien ejecuta.
 *
 * Uso:
 *   npx tsx scripts/recalc-recurring-next-run.ts          # dry-run (no escribe)
 *   npx tsx scripts/recalc-recurring-next-run.ts --apply  # aplica los cambios
 */
process.env.TZ = "UTC";

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { computeNextRunAt, type RecurrencePattern } from "../src/lib/recurrence";

const APPLY = process.argv.includes("--apply");
const MAX_ITER = 20000; // tope de seguridad para cadenas muy largas

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

/** Medianoche UTC del día calendario de la fecha dada. */
function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function fmt(d: Date | null): string {
  if (!d) return "—";
  return d.toISOString().replace(".000Z", "Z");
}

async function main() {
  const templates = await prisma.recurringTaskTemplate.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      frequency: true,
      interval: true,
      daysOfWeek: true,
      dayOfMonth: true,
      startDate: true,
      lastRunAt: true,
      nextRunAt: true,
    },
  });

  console.log(`Modo: ${APPLY ? "APLICAR (escribe en BD)" : "DRY-RUN (solo muestra)"}`);
  console.log(`Plantillas encontradas: ${templates.length}\n`);

  let changed = 0;
  let skipped = 0;

  for (const t of templates) {
    const pattern: RecurrencePattern = {
      frequency: t.frequency,
      interval: t.interval,
      daysOfWeek: t.daysOfWeek,
      dayOfMonth: t.dayOfMonth,
    };

    // Ancla canónica: medianoche UTC del startDate.
    let occ = utcMidnight(t.startDate);

    // Avanza hasta superar lastRunAt (la última generación ya ocurrió).
    let iter = 0;
    if (t.lastRunAt) {
      const last = t.lastRunAt.getTime();
      while (occ.getTime() <= last) {
        occ = computeNextRunAt(occ, pattern);
        if (++iter > MAX_ITER) {
          console.warn(`  ⚠ ${t.title} (${t.id}): superó ${MAX_ITER} iteraciones, se omite.`);
          break;
        }
      }
    }
    if (iter > MAX_ITER) {
      skipped++;
      continue;
    }

    const canonical = occ;
    const current = t.nextRunAt;

    if (current.getTime() === canonical.getTime()) {
      skipped++;
      continue;
    }

    changed++;
    console.log(`• ${t.title} (${t.id})`);
    console.log(`    frecuencia=${t.frequency} intervalo=${t.interval}` +
      `${t.daysOfWeek ? ` dias=${t.daysOfWeek}` : ""}${t.dayOfMonth != null ? ` diaMes=${t.dayOfMonth}` : ""}`);
    console.log(`    startDate=${fmt(t.startDate)}  lastRunAt=${fmt(t.lastRunAt)}`);
    console.log(`    nextRunAt: ${fmt(current)}  →  ${fmt(canonical)}`);

    if (APPLY) {
      await prisma.recurringTaskTemplate.update({
        where: { id: t.id },
        data: { nextRunAt: canonical },
      });
    }
  }

  console.log(`\nResumen: ${changed} a corregir, ${skipped} ya correctas/omitidas.`);
  if (changed > 0 && !APPLY) {
    console.log(`\nEsto fue un DRY-RUN. Para aplicar:`);
    console.log(`  npx tsx scripts/recalc-recurring-next-run.ts --apply`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
