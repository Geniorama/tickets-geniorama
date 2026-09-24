// Resumen corto del tiempo registrado en una ficha, para la pestaña «Tiempo».
// Sin Date.now(): se calcula al renderizar en servidor y cliente, y un valor
// que cambia entre uno y otro rompería la hidratación. Por eso una entrada
// abierta se anuncia como «en curso» en vez de sumarse.

type Entry = { startedAt: Date | string; stoppedAt: Date | string | null };

function formatHours(ms: number) {
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** «1h 20m», «1h 20m · en curso», «en curso» o null si no hay nada registrado. */
export function summarizeTime(entries: Entry[]): string | null {
  if (entries.length === 0) return null;
  let total = 0;
  let running = false;
  for (const e of entries) {
    if (!e.stoppedAt) {
      running = true;
      continue;
    }
    total += new Date(e.stoppedAt).getTime() - new Date(e.startedAt).getTime();
  }
  const done = total > 0 ? formatHours(total) : null;
  if (running) return done ? `${done} · en curso` : "en curso";
  return done ?? "0m";
}
