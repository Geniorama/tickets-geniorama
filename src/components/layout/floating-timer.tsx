"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { FileText, CheckSquare, StopCircle } from "lucide-react";
import { useTimerContext } from "@/providers/timer-provider";
import type { ActiveTimer } from "@/providers/timer-provider";
import { pauseTimer } from "@/actions/time.actions";
import { pauseTaskTimer } from "@/actions/task-time.actions";

function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function FloatingTimer() {
  const { timers, unregisterTimer } = useTimerContext();
  const pathname = usePathname();
  const [now, setNow] = useState(Date.now());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (timers.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timers.length]);

  // Solo mostrar timers cuya página no está activa — si el usuario está en
  // la página del ticket/tarea, ya ve el timer ahí; el pill sería redundante.
  const visible = timers.filter((t) => {
    if (t.type === "ticket") return !pathname.startsWith(`/tickets/${t.resourceId}`);
    if (t.type === "task") return !pathname.includes(`/tareas/${t.resourceId}`);
    return true;
  });

  if (visible.length === 0) return null;

  function handleStop(timer: ActiveTimer) {
    startTransition(async () => {
      if (timer.type === "ticket") {
        await pauseTimer(timer.resourceId);
      } else {
        await pauseTaskTimer(timer.resourceId, timer.projectId!);
      }
      unregisterTimer(timer.type, timer.resourceId);
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 9000,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      {visible.map((timer) => {
        const elapsed = now - new Date(timer.startedAt).getTime();
        const href =
          timer.type === "ticket"
            ? `/tickets/${timer.resourceId}`
            : `/proyectos/${timer.projectId}/tareas/${timer.resourceId}`;
        const Icon = timer.type === "ticket" ? FileText : CheckSquare;

        return (
          <div
            key={`${timer.type}-${timer.resourceId}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              backgroundColor: "var(--app-card-bg)",
              border: "1px solid var(--app-border)",
              borderRadius: "0.75rem",
              padding: "0.625rem 0.875rem",
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              minWidth: "260px",
              maxWidth: "320px",
            }}
          >
            {/* Dot animado */}
            <span
              style={{
                width: "0.5rem",
                height: "0.5rem",
                borderRadius: "50%",
                backgroundColor: "#22c55e",
                flexShrink: 0,
                animation: "pulse 2s infinite",
              }}
            />

            {/* Ícono tipo */}
            <Icon
              style={{
                width: "0.875rem",
                height: "0.875rem",
                color: "var(--app-text-muted)",
                flexShrink: 0,
              }}
            />

            {/* Título — navega al ticket/tarea */}
            <Link
              href={href}
              style={{
                flex: 1,
                fontSize: "0.8125rem",
                fontWeight: 500,
                color: "var(--app-body-text)",
                textDecoration: "none",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = "#4f46e5")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color =
                  "var(--app-body-text)")
              }
            >
              {timer.title}
            </Link>

            {/* Tiempo transcurrido */}
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "#16a34a",
                flexShrink: 0,
              }}
            >
              {formatDuration(elapsed)}
            </span>

            {/* Botón detener — cerrar el pill DETIENE el timer */}
            <button
              onClick={() => handleStop(timer)}
              disabled={isPending}
              title="Detener timer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.25rem",
                borderRadius: "0.375rem",
                border: "none",
                background: "none",
                cursor: isPending ? "not-allowed" : "pointer",
                color: "var(--app-text-muted)",
                flexShrink: 0,
                opacity: isPending ? 0.5 : 1,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "#dc2626")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color =
                  "var(--app-text-muted)")
              }
            >
              <StopCircle style={{ width: "1rem", height: "1rem" }} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
