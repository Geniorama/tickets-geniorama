"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { convertFeedbackToTask, setFeedbackStatus } from "@/actions/feedback.actions";
import { runAction } from "@/lib/run-action";
import { FEEDBACK_STATUS_LABELS, type FeedbackStatusKey } from "@/lib/feedback";

/** Estados a los que se puede mover a mano: «Convertido» solo se alcanza convirtiendo. */
const MANUAL: FeedbackStatusKey[] = ["NUEVO", "EN_REVISION", "DESCARTADO"];

export function FeedbackActions({
  id,
  status,
  taskUrl,
  projects,
  defaultProjectId,
}: {
  id: string;
  status: FeedbackStatusKey;
  /** Si ya se convirtió: dónde está la tarea. */
  taskUrl: string | null;
  projects: { id: string; name: string }[];
  defaultProjectId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [converted, setConverted] = useState<string | null>(null);

  const done = status === "CONVERTIDO" || converted;
  const link = converted ?? taskUrl;

  function changeStatus(next: string) {
    setError(null);
    startTransition(async () => {
      const r = await runAction(() => setFeedbackStatus(id, next));
      if (!r.ok) return setError(r.error);
      if ("error" in r.data && r.data.error) setError(r.data.error);
    });
  }

  function convert() {
    if (!projectId) return setError("Elige el proyecto de la tarea");
    setError(null);
    startTransition(async () => {
      const r = await runAction(() => convertFeedbackToTask(id, projectId));
      if (!r.ok) return setError(r.error);
      if ("error" in r.data && r.data.error) return setError(r.data.error);
      if ("taskUrl" in r.data && r.data.taskUrl) setConverted(r.data.taskUrl);
    });
  }

  const field =
    "rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {done ? (
        <>
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            {FEEDBACK_STATUS_LABELS.CONVERTIDO}
          </span>
          {link && (
            <Link href={link} className="text-xs font-medium text-indigo-600 hover:underline">
              Ver tarea
            </Link>
          )}
        </>
      ) : (
        <>
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value)}
            disabled={isPending}
            className={field}
            aria-label="Estado"
          >
            {MANUAL.map((s) => (
              <option key={s} value={s}>{FEEDBACK_STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={isPending}
            className={field}
            aria-label="Proyecto de la tarea"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={convert}
            disabled={isPending || projects.length === 0}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Convertir en tarea
          </button>
        </>
      )}
      {error && <span className="text-xs text-red-600" role="alert">{error}</span>}
    </div>
  );
}
