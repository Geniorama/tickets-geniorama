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
  const [now, setNow] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setNow(Date.now());
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
              gap: "0.75rem",
              backgroundColor: "rgba(10, 15, 25, 0.96)",
              border: "1px solid rgba(34,197,94,0.35)",
              borderLeft: "3px solid #22c55e",
              borderRadius: "0.75rem",
              padding: "0.625rem 0.875rem 0.625rem 0.75rem",
              boxShadow: "0 12px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(34,197,94,0.1)",
              minWidth: "270px",
              maxWidth: "340px",
              backdropFilter: "blur(8px)",
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
                boxShadow: "0 0 6px #22c55e",
                animation: "pulse 2s infinite",
              }}
            />

            {/* Ícono tipo */}
            <Icon
              style={{
                width: "0.875rem",
                height: "0.875rem",
                color: "rgba(255,255,255,0.4)",
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
                color: "rgba(255,255,255,0.85)",
                textDecoration: "none",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color = "#86efac")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLAnchorElement).style.color =
                  "rgba(255,255,255,0.85)")
              }
            >
              {timer.title}
            </Link>

            {/* Tiempo transcurrido */}
            <span
              style={{
                fontFamily: "monospace",
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "#4ade80",
                flexShrink: 0,
                letterSpacing: "0.02em",
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
                color: "rgba(255,255,255,0.3)",
                flexShrink: 0,
                opacity: isPending ? 0.5 : 1,
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "#f87171")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color =
                  "rgba(255,255,255,0.3)")
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
