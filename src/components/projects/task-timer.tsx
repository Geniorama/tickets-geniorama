"use client";

import { useEffect, useState, useTransition } from "react";
import { Play, Pause, Clock, Plus, X, Trash2, RotateCcw } from "lucide-react";
import {
  startTaskTimer,
  pauseTaskTimer,
  addManualTaskEntry,
  deleteTaskTimeEntry,
  resetTaskTimeEntries,
} from "@/actions/task-time.actions";
import { useTimerContext } from "@/providers/timer-provider";

interface TimeEntryRow {
  id: string;
  startedAt: Date | string;
  stoppedAt: Date | string | null;
  userId: string;
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

export function TaskTimer({
  taskId,
  projectId,
  title,
  entries,
  canControl,
  isAdmin,
  currentUserId,
}: {
  taskId: string;
  projectId: string;
  title: string;
  entries: TimeEntryRow[];
  canControl: boolean;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const { registerTimer, unregisterTimer } = useTimerContext();
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
  const [showManual, setShowManual] = useState(false);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [manualError, setManualError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const activeEntry = entries.find((e) => e.stoppedAt === null) ?? null;
  const userActiveEntry = entries.find(
    (e) => e.stoppedAt === null && e.userId === currentUserId,
  ) ?? null;

  // Sincronizar con el context global (pastilla flotante)
  useEffect(() => {
    if (userActiveEntry) {
      registerTimer({
        type: "task",
        resourceId: taskId,
        projectId,
        title,
        startedAt: String(userActiveEntry.startedAt),
      });
    } else {
      unregisterTimer("task", taskId);
    }
  }, [userActiveEntry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        await pauseTaskTimer(taskId, projectId);
      } else {
        await startTaskTimer(taskId, projectId);
      }
    });
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    setManualError(null);
    startTransition(async () => {
      const result = await addManualTaskEntry(taskId, projectId, hours, minutes);
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
      await deleteTaskTimeEntry(entryId, taskId, projectId);
    });
  }

  function handleReset() {
    startTransition(async () => {
      await resetTaskTimeEntries(taskId, projectId);
      setConfirmReset(false);
    });
  }

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        padding: "1.5rem",
      }}
    >
      <h2
        style={{
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: "var(--app-body-text)",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <Clock style={{ width: "1rem", height: "1rem" }} />
        Tiempo de ejecución
      </h2>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: "1.875rem",
            fontFamily: "monospace",
            fontWeight: 600,
            color: "var(--app-body-text)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatDuration(totalMs)}
        </span>

        {canControl && (!activeEntry || activeEntry.userId === currentUserId) && (
          <button
            onClick={handleToggle}
            disabled={isPending}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.75rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
              opacity: isPending ? 0.6 : 1,
              backgroundColor: activeEntry ? "#fef3c7" : "#dcfce7",
              color: activeEntry ? "#b45309" : "#15803d",
            }}
          >
            {activeEntry ? (
              <><Pause style={{ width: "0.875rem", height: "0.875rem" }} />Pausar</>
            ) : (
              <><Play style={{ width: "0.875rem", height: "0.875rem" }} />{entries.length > 0 ? "Reanudar" : "Iniciar"}</>
            )}
          </button>
        )}

        {isAdmin && !showManual && (
          <button
            onClick={() => setShowManual(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.75rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "1px solid var(--app-border)",
              background: "none",
              color: "var(--app-text-muted)",
              cursor: "pointer",
            }}
          >
            <Plus style={{ width: "0.875rem", height: "0.875rem" }} />
            Agregar manual
          </button>
        )}

        {isAdmin && entries.length > 0 && !confirmReset && (
          <button
            onClick={() => setConfirmReset(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.375rem 0.75rem",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "none",
              background: "none",
              color: "#dc2626",
              cursor: "pointer",
            }}
          >
            <RotateCcw style={{ width: "0.875rem", height: "0.875rem" }} />
            Resetear
          </button>
        )}

        {isAdmin && confirmReset && (
          <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
            <span style={{ color: "var(--app-text-muted)" }}>¿Eliminar todo el tiempo?</span>
            <button
              onClick={handleReset}
              disabled={isPending}
              style={{
                padding: "0.25rem 0.625rem",
                backgroundColor: "#dc2626",
                color: "#fff",
                borderRadius: "0.5rem",
                fontSize: "0.75rem",
                fontWeight: 500,
                border: "none",
                cursor: "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Confirmar
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", background: "none", border: "none", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </span>
        )}

        {activeEntry && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.75rem",
              color: "#16a34a",
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: "0.5rem",
                height: "0.5rem",
                borderRadius: "50%",
                backgroundColor: "#22c55e",
                display: "inline-block",
                animation: "pulse 2s infinite",
              }}
            />
            En curso · {activeEntry.user.name}
          </span>
        )}
      </div>

      {isAdmin && showManual && (
        <form
          onSubmit={handleManualSubmit}
          style={{
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--app-border)",
            display: "flex",
            alignItems: "flex-end",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginBottom: "0.25rem" }}>
              Horas
            </label>
            <input
              type="number"
              min={0}
              value={hours}
              onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
              style={{
                width: "5rem",
                border: "1px solid var(--app-border)",
                borderRadius: "0.5rem",
                padding: "0.375rem 0.5rem",
                fontSize: "0.875rem",
                color: "var(--app-body-text)",
                backgroundColor: "var(--app-card-bg)",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginBottom: "0.25rem" }}>
              Minutos
            </label>
            <input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
              style={{
                width: "5rem",
                border: "1px solid var(--app-border)",
                borderRadius: "0.5rem",
                padding: "0.375rem 0.5rem",
                fontSize: "0.875rem",
                color: "var(--app-body-text)",
                backgroundColor: "var(--app-card-bg)",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={isPending || (hours === 0 && minutes === 0)}
            style={{
              padding: "0.375rem 0.75rem",
              backgroundColor: "#4f46e5",
              color: "#fff",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              border: "none",
              cursor: "pointer",
              opacity: isPending || (hours === 0 && minutes === 0) ? 0.6 : 1,
            }}
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={() => { setShowManual(false); setManualError(null); }}
            style={{ padding: "0.375rem", color: "var(--app-text-muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            <X style={{ width: "1rem", height: "1rem" }} />
          </button>
          {manualError && (
            <p style={{ width: "100%", fontSize: "0.75rem", color: "#dc2626" }}>{manualError}</p>
          )}
        </form>
      )}

      {canControl && entries.length > 0 && (
        <div
          style={{
            marginTop: "1rem",
            paddingTop: "1rem",
            borderTop: "1px solid var(--app-border)",
          }}
        >
          <p
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              color: "var(--app-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "0.5rem",
            }}
          >
            Sesiones
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            {entries.map((entry, i) => {
              const start = new Date(entry.startedAt as string).getTime();
              const entryMs = entry.stoppedAt
                ? new Date(entry.stoppedAt as string).getTime() - start
                : now - start;
              return (
                <div
                  key={entry.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "0.75rem",
                    color: "var(--app-text-muted)",
                  }}
                >
                  <span>
                    #{i + 1} — {entry.user.name}
                    {!entry.stoppedAt && (
                      <span style={{ marginLeft: "0.375rem", color: "#16a34a", fontWeight: 500 }}>
                        (activa)
                      </span>
                    )}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontFamily: "monospace", color: "var(--app-body-text)" }}>
                      {formatDuration(entryMs)}
                    </span>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={isPending}
                        title="Eliminar sesión"
                        style={{
                          color: "var(--app-border)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          opacity: isPending ? 0.4 : 1,
                          padding: 0,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--app-border)")}
                      >
                        <Trash2 style={{ width: "0.875rem", height: "0.875rem" }} />
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
