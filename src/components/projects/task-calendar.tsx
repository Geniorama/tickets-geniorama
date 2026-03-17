"use client";

import { useRouter } from "next/navigation";
import { Calendar, dateFnsLocalizer, type Event, type EventProps } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import styles from "./task-calendar.module.css";
import type { Task, TaskStatus } from "@/generated/prisma";
import { taskCode } from "@/lib/task-code";

const locales = { es };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: es }),
  getDay,
  locales,
});

const STATUS_CONFIG: Record<TaskStatus, { bg: string; border: string; label: string }> = {
  PENDIENTE:   { bg: "rgba(100,116,139,0.15)", border: "#64748b", label: "Pendiente" },
  EN_PROGRESO: { bg: "rgba(59,130,246,0.15)",  border: "#3b82f6", label: "En progreso" },
  EN_REVISION: { bg: "rgba(139,92,246,0.15)",  border: "#8b5cf6", label: "En revisión" },
  COMPLETADO:  { bg: "rgba(34,197,94,0.15)",   border: "#22c55e", label: "Completado" },
};

type TaskWithRelations = Task & {
  assignedTo: { name: string } | null;
  project: { id: string; name: string };
};

interface CalendarEvent extends Event {
  taskId: string;
  projectId: string;
  status: TaskStatus;
  assignee: string | null;
}

const messages = {
  allDay: "Todo el día",
  previous: "←",
  next: "→",
  today: "Hoy",
  month: "Mes",
  week: "Semana",
  day: "Día",
  agenda: "Agenda",
  date: "Fecha",
  time: "Hora",
  event: "Tarea",
  noEventsInRange: "No hay tareas en este período.",
  showMore: (total: number) => `+${total} más`,
};

function EventComponent({ event }: EventProps<CalendarEvent>) {
  const cfg = STATUS_CONFIG[event.status];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", overflow: "hidden" }}>
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "9999px",
          backgroundColor: cfg.border,
          flexShrink: 0,
        }}
      />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {event.title as string}
      </span>
    </div>
  );
}

export function TaskCalendar({
  tasks,
  projectId,
}: {
  tasks: TaskWithRelations[];
  projectId: string;
}) {
  const router = useRouter();

  const events: CalendarEvent[] = tasks
    .filter((t) => t.dueDate)
    .map((task) => ({
      title: task.number > 0 ? `${taskCode(task.project.name, task.number)} ${task.title}` : task.title,
      start: task.startDate ? new Date(task.startDate) : new Date(task.dueDate!),
      end: new Date(task.dueDate!),
      taskId: task.id,
      projectId: task.project.id,
      status: task.status as TaskStatus,
      assignee: task.assignedTo?.name ?? null,
      allDay: true,
    }));

  function eventPropGetter(event: CalendarEvent) {
    const cfg = STATUS_CONFIG[event.status];
    return {
      style: {
        backgroundColor: cfg.bg,
        borderLeft: `3px solid ${cfg.border}`,
        borderTop: "none",
        borderRight: "none",
        borderBottom: "none",
        borderRadius: "4px",
        color: "var(--app-body-text)",
        fontSize: "0.75rem",
        fontWeight: 500,
        padding: "2px 6px",
        cursor: "pointer",
      },
    };
  }

  function handleSelectEvent(event: CalendarEvent) {
    router.push(`/proyectos/${event.projectId}/tareas/${event.taskId}`);
  }

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        padding: "1.25rem",
      }}
    >
      {/* Leyenda */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid var(--app-border)",
        }}
      >
        {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG[TaskStatus]][]).map(
          ([, cfg]) => (
            <div
              key={cfg.label}
              style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  backgroundColor: cfg.bg,
                  border: `2px solid ${cfg.border}`,
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                {cfg.label}
              </span>
            </div>
          )
        )}

        {tasks.filter((t) => !t.dueDate).length > 0 && (
          <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginLeft: "auto" }}>
            {tasks.filter((t) => !t.dueDate).length} tarea
            {tasks.filter((t) => !t.dueDate).length !== 1 ? "s" : ""} sin fecha
          </span>
        )}
      </div>

      {/* Calendario */}
      <div className={styles.wrapper} style={{ height: "600px" }}>
        <Calendar
          localizer={localizer}
          events={events}
          defaultView="month"
          views={["month", "week", "agenda"]}
          messages={messages}
          culture="es"
          onSelectEvent={handleSelectEvent}
          eventPropGetter={eventPropGetter}
          components={{ event: EventComponent }}
          style={{ height: "100%" }}
          popup
        />
      </div>
    </div>
  );
}
