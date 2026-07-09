// Utilidades para el tiempo estimado de tareas.
//
// Internamente se sigue guardando como horas decimales (Float en Prisma), pero
// se ingresa y se muestra en formato horas + minutos (p. ej. 2h 30m = 2.5h).

/** Divide horas decimales en { hours, minutes } para prellenar los inputs. */
export function splitEstimatedHours(
  value: number | null | undefined,
): { hours: number | null; minutes: number | null } {
  if (value == null || Number.isNaN(value) || value <= 0) {
    return { hours: null, minutes: null };
  }
  const totalMinutes = Math.round(value * 60);
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/** Combina horas + minutos (crudos de un formulario) en horas decimales, o null. */
export function combineEstimatedTime(
  hoursRaw: string | number | null | undefined,
  minutesRaw: string | number | null | undefined,
): number | null {
  const hours = hoursRaw === "" || hoursRaw == null ? 0 : Number(hoursRaw);
  const minutes = minutesRaw === "" || minutesRaw == null ? 0 : Number(minutesRaw);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const total = hours + minutes / 60;
  return total > 0 ? total : null;
}

/** Formatea horas decimales como "2h 30m" / "45m" / "3h". Devuelve "—" si no hay valor. */
export function formatEstimatedTime(value: number | null | undefined): string {
  const { hours, minutes } = splitEstimatedHours(value);
  if (hours == null || minutes == null) return "—";
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return "—";
}
