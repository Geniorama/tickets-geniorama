"use client";

/**
 * El historial de una ficha, en línea de tiempo.
 *
 * Una entrada es siempre la misma frase: quién, qué hizo y, si tocó algo, de
 * qué a qué. El color del punto separa lo que se busca al auditar —un cambio de
 * estado o de importe— de lo que solo acompaña.
 *
 * Recibe la primera página ya resuelta desde el servidor y pide las siguientes
 * bajo demanda: un ticket viejo puede tener cientos de movimientos y ninguno de
 * los que importan está al final.
 */

import { useState, useTransition } from "react";
import { History } from "lucide-react";
import { getMoreActivity, type ActivityPage } from "@/actions/activity.actions";
import { describeActivity } from "@/lib/activity/describe";
import { formatDateTimeLong } from "@/lib/format-date";
import type { EntityType } from "@/generated/prisma";

export type ActivityItem = ActivityPage["entries"][number];

/** El punto de la línea: el color dice de qué tipo es el movimiento. */
const TONE_DOT: Record<string, string> = {
  create: "bg-green-600",
  update: "bg-gray-400",
  move: "bg-amber-700",
  destroy: "bg-red-600",
};

function Entry({ item }: { item: ActivityItem }) {
  const { verb, tone, changes, notes } = describeActivity(item);
  const who = item.actor?.name ?? item.actorName ?? "La plataforma";

  return (
    <li className="relative pl-6">
      <span
        className={`absolute left-0 top-[7px] h-2 w-2 rounded-full ${TONE_DOT[tone] ?? TONE_DOT.update}`}
        aria-hidden
      />

      <p className="text-sm text-gray-700">
        <span className="font-medium text-gray-900">{who}</span> {verb}
      </p>

      {changes.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {changes.map((change) => (
            <li key={change.field} className="text-xs text-gray-500">
              {/* Cuando la acción ya nombró el campo —«cambió el estado»— la
                  línea solo trae el de/a: repetirlo sonaría a tartamudeo. */}
              {change.showLabel && <span className="text-gray-600">{change.label}: </span>}
              <span className="line-through decoration-gray-400">{change.from}</span>
              <span aria-hidden> → </span>
              <span className="font-medium text-gray-700">{change.to}</span>
            </li>
          ))}
        </ul>
      )}

      {notes.map((note, i) => (
        <p key={i} className="mt-1 text-xs text-gray-500">
          {note}
        </p>
      ))}

      <time
        dateTime={item.createdAt}
        className="mt-1 block text-xs text-gray-400"
      >
        {formatDateTimeLong(item.createdAt)}
      </time>
    </li>
  );
}

export function ActivityTimeline({
  entityType,
  entityId,
  initial,
  hasMore: initialHasMore,
  title = "Historial",
  emptyLabel = "Todavía no hay movimientos registrados.",
}: {
  entityType: EntityType;
  entityId: string;
  initial: ActivityItem[];
  hasMore: boolean;
  title?: string;
  emptyLabel?: string;
}) {
  const [items, setItems] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    const oldest = items[items.length - 1];
    if (!oldest) return;

    startTransition(async () => {
      const page = await getMoreActivity(entityType, entityId, oldest.createdAt);
      setItems((prev) => [...prev, ...page.entries]);
      setHasMore(page.hasMore);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-gray-400" aria-hidden />
        {title}
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyLabel}</p>
      ) : (
        <>
          {/* La línea vertical vive en el ul y no en cada punto: así no se
              parte entre entradas de distinta altura. */}
          <ul className="relative space-y-4 before:absolute before:left-[3px] before:top-2 before:bottom-2 before:w-px before:bg-gray-200">
            {items.map((item) => (
              <Entry key={item.id} item={item} />
            ))}
          </ul>

          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              disabled={pending}
              className="mt-4 w-full py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-60"
            >
              {pending ? "Cargando…" : "Ver movimientos anteriores"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
