"use client";

import { useEffect, useState, useTransition } from "react";
import { Play, Pause, Clock, Plus, X, Trash2, RotateCcw } from "lucide-react";
import { startTimer, pauseTimer, addManualEntry, deleteTimeEntry, resetTimeEntries } from "@/actions/time.actions";

interface TimeEntryRow {
  id: string;
  startedAt: Date | string;
  stoppedAt: Date | string | null;
  user: { name: string };
}

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TicketTimer({
  ticketId,
  entries,
  canControl,
  isAdmin,
}: {
  ticketId: string;
  entries: TimeEntryRow[];
  canControl: boolean;
  isAdmin: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [showManual, setShowManual] = useState(false);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [manualError, setManualError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const activeEntry = entries.find((e) => e.stoppedAt === null) ?? null;

  useEffect(() => {
    if (!activeEntry) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeEntry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const completedMs = entries
    .filter((e) => e.stoppedAt !== null)
    .reduce((acc, e) => {
      const start = new Date(e.startedAt as string).getTime();
      const stop = new Date(e.stoppedAt as string).getTime();
      return acc + (stop - start);
    }, 0);

  const activeMs = activeEntry
    ? now - new Date(activeEntry.startedAt as string).getTime()
    : 0;

  const totalMs = completedMs + activeMs;

  function handleToggle() {
    startTransition(async () => {
      if (activeEntry) {
        await pauseTimer(ticketId);
      } else {
        await startTimer(ticketId);
      }
    });
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setManualError(null);
    startTransition(async () => {
      const result = await addManualEntry(ticketId, hours, minutes);
      if (result?.error) {
        setManualError(result.error);
      } else {
        setShowManual(false);
        setHours(0);
        setMinutes(0);
      }
    });
  }

  function handleDeleteEntry(entryId: string) {
    startTransition(async () => {
      await deleteTimeEntry(entryId, ticketId);
    });
  }

  function handleReset() {
    startTransition(async () => {
      await resetTimeEntries(ticketId);
      setConfirmReset(false);
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4" />
        Tiempo de ejecución
      </h2>

      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-3xl font-mono font-semibold text-gray-900 tabular-nums">
          {formatDuration(totalMs)}
        </span>

        {canControl && (
          <button
            onClick={handleToggle}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 ${
              activeEntry
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            {activeEntry ? (
              <><Pause className="w-3.5 h-3.5" />Pausar</>
            ) : (
              <><Play className="w-3.5 h-3.5" />{entries.length > 0 ? "Reanudar" : "Iniciar"}</>
            )}
          </button>
        )}

        {isAdmin && !showManual && (
          <button
            onClick={() => setShowManual(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Agregar manual
          </button>
        )}

        {isAdmin && entries.length > 0 && !confirmReset && (
          <button
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Resetear
          </button>
        )}

        {isAdmin && confirmReset && (
          <span className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">¿Eliminar todo el tiempo?</span>
            <button
              onClick={handleReset}
              disabled={isPending}
              className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              Confirmar
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="px-2.5 py-1 text-gray-500 hover:text-gray-700 text-xs"
            >
              Cancelar
            </button>
          </span>
        )}

        {activeEntry && (
          <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            En curso · {activeEntry.user.name}
          </span>
        )}
      </div>

      {isAdmin && showManual && (
        <form
          onSubmit={handleManualSubmit}
          className="mt-4 pt-4 border-t border-gray-100 flex items-end gap-3 flex-wrap"
        >
          <div>
            <label className="block text-xs text-gray-500 mb-1">Horas</label>
            <input
              type="number"
              min={0}
              value={hours}
              onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Minutos</label>
            <input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
              className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={isPending || (hours === 0 && minutes === 0)}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => { setShowManual(false); setManualError(null); }}
            className="p-1.5 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
          {manualError && (
            <p className="w-full text-xs text-red-600">{manualError}</p>
          )}
        </form>
      )}

      {canControl && entries.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
            Sesiones
          </p>
          <div className="space-y-1.5">
            {entries.map((entry, i) => {
              const start = new Date(entry.startedAt as string).getTime();
              const entryMs = entry.stoppedAt
                ? new Date(entry.stoppedAt as string).getTime() - start
                : now - start;
              return (
                <div key={entry.id} className="flex items-center justify-between text-xs text-gray-500">
                  <span>
                    #{i + 1} &mdash; {entry.user.name}
                    {!entry.stoppedAt && (
                      <span className="ml-1.5 text-green-600 font-medium">(activa)</span>
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-gray-700">{formatDuration(entryMs)}</span>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={isPending}
                        title="Eliminar sesión"
                        className="text-gray-300 hover:text-red-500 disabled:opacity-40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
