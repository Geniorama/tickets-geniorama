/**
 * El historial de toda la plataforma.
 *
 * Es la otra mitad del historial: en una ficha se pregunta «¿qué le pasó a
 * esto?», y aquí «¿qué se hizo hoy?» o «¿qué ha tocado esta persona?». La misma
 * tabla contesta las dos, y por eso lleva índice por entidad y por fecha suelta.
 *
 * Pide GESTOR sobre Administración: el historial cruza módulos —un cobro, una
 * credencial, un permiso— y quien lo lee ve movimientos de sitios donde a lo
 * mejor no entra. No es una pantalla para repartir.
 */

import Link from "next/link";
import { requireCan } from "@/lib/access/can";
import {
  ENTITY_LABELS,
  MODULE_LABELS,
  MODULE_OF_ENTITY,
  entityHref,
  type ActivityModule,
} from "@/lib/activity/catalog";
import { describeActivity, metaHref } from "@/lib/activity/describe";
import { activityActors, listGlobalActivity, type ActivityEntry } from "@/lib/activity/list";
import { formatDateTimeLong } from "@/lib/format-date";
import { ActivityFilters } from "@/components/admin/activity-filters";

export const metadata = { title: "Actividad" };

const TONE_DOT: Record<string, string> = {
  create: "bg-green-600",
  update: "bg-gray-400",
  move: "bg-amber-700",
  destroy: "bg-red-600",
};

const PAGE = 60;

/** Una fecha del filtro, o null si no la hay. `hasta` cubre el día entero. */
function leerFecha(raw: string | undefined, finDelDia = false): Date | null {
  if (!raw) return null;
  const d = new Date(finDelDia ? `${raw}T23:59:59.999` : `${raw}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function Fila({ entry }: { entry: ActivityEntry }) {
  const { verb, tone, changes, notes } = describeActivity(entry);
  const who = entry.actor?.name ?? entry.actorName ?? "La plataforma";
  const href = metaHref(entry.meta) ?? entityHref(entry.entityType, entry.entityId);
  const que = ENTITY_LABELS[entry.entityType];

  const nombre = entry.entityLabel ?? `${que} sin nombre`;

  return (
    <li className="flex gap-3 border-b border-gray-100 py-3 last:border-0">
      <span
        className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${TONE_DOT[tone] ?? TONE_DOT.update}`}
        aria-hidden
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-700">
          <span className="font-medium text-gray-900">{who}</span> {verb}{" "}
          {href ? (
            <Link href={href} className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-600">
              {nombre}
            </Link>
          ) : (
            <span className="font-medium text-gray-900">{nombre}</span>
          )}
        </p>

        {changes.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {changes.map((c) => (
              <li key={c.field} className="text-xs text-gray-500">
                {c.showLabel && <span className="text-gray-600">{c.label}: </span>}
                <span className="line-through decoration-gray-400">{c.from}</span>
                <span aria-hidden> → </span>
                <span className="font-medium text-gray-700">{c.to}</span>
              </li>
            ))}
          </ul>
        )}

        {notes.map((n, i) => (
          <p key={i} className="mt-1 text-xs text-gray-500">
            {n}
          </p>
        ))}
      </div>

      <div className="shrink-0 text-right">
        <time dateTime={entry.createdAt.toISOString()} className="block text-xs text-gray-400">
          {formatDateTimeLong(entry.createdAt)}
        </time>
        <span className="text-xs text-gray-400">
          {MODULE_LABELS[MODULE_OF_ENTITY[entry.entityType]]}
        </span>
      </div>
    </li>
  );
}

export default async function ActividadPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCan("ADMIN", "gestionar");

  const sp = await searchParams;
  const uno = (k: string) => {
    const v = sp[k];
    return typeof v === "string" && v ? v : undefined;
  };

  const modulo = uno("modulo") as ActivityModule | undefined;
  const cursorId = uno("cursor");

  // El cursor es solo un id: Prisma resuelve desde esa fila, así que no hace
  // falta pasear una fecha por la URL que además podría no cuadrar con ella.
  const [{ entries, nextCursorId }, actors] = await Promise.all([
    listGlobalActivity(
      {
        module: modulo ?? null,
        action: uno("accion") ?? null,
        actorId: uno("persona") ?? null,
        from: leerFecha(uno("desde")),
        to: leerFecha(uno("hasta"), true),
        q: uno("q") ?? null,
      },
      cursorId,
      PAGE,
    ),
    activityActors(),
  ]);

  const siguiente = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && v ? [[k, v] as [string, string]] : [])),
  );
  if (nextCursorId) siguiente.set("cursor", nextCursorId);

  return (
    <div className="p-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Actividad</h1>
        <p className="mt-1 text-sm text-gray-500">
          Todo lo que se ha hecho en la plataforma: tickets, tareas, proyectos, cobros, CRM y
          administración. No se puede editar ni borrar desde aquí.
        </p>
      </header>

      <div className="mb-4">
        <ActivityFilters actors={actors} />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        {entries.length === 0 ? (
          <p className="text-sm text-gray-400">
            No hay movimientos que cumplan eso.
          </p>
        ) : (
          <ul>
            {entries.map((entry) => (
              <Fila key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>

      {nextCursorId && (
        <div className="mt-4 flex justify-center">
          <Link
            href={`/admin/actividad?${siguiente.toString()}`}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Ver más antiguos
          </Link>
        </div>
      )}
    </div>
  );
}
