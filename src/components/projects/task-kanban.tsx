"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Circle, Clock, Eye, CheckCircle2, GripVertical } from "lucide-react";
import type { Task, TaskStatus, Priority } from "@/generated/prisma";
import { TaskPriorityBadge } from "./project-status-badge";
import { formatDate } from "@/lib/format-date";
import { updateTaskStatus } from "@/actions/task.actions";
import { taskCode } from "@/lib/task-code";

type TaskWithRelations = Task & {
  assignedTo: { name: string } | null;
  project: { id: string; name: string };
  _count: { comments: number };
};

const columns: {
  status: TaskStatus;
  label: string;
  icon: React.ElementType;
  borderColor: string;
  countBg: string;
  countColor: string;
}[] = [
  {
    status: "PENDIENTE",
    label: "Pendiente",
    icon: Circle,
    borderColor: "#9ca3af",
    countBg: "#f3f4f6",
    countColor: "#374151",
  },
  {
    status: "EN_PROGRESO",
    label: "En progreso",
    icon: Clock,
    borderColor: "#3b82f6",
    countBg: "#dbeafe",
    countColor: "#1d4ed8",
  },
  {
    status: "EN_REVISION",
    label: "En revisión",
    icon: Eye,
    borderColor: "#8b5cf6",
    countBg: "#ede9fe",
    countColor: "#6d28d9",
  },
  {
    status: "COMPLETADO",
    label: "Completado",
    icon: CheckCircle2,
    borderColor: "#22c55e",
    countBg: "#dcfce7",
    countColor: "#15803d",
  },
];

function TaskCard({
  task,
  projectId,
  isDragging = false,
}: {
  task: TaskWithRelations;
  projectId: string;
  isDragging?: boolean;
}) {
  return (
    <div
      style={{
        backgroundColor: "var(--app-content-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.5rem",
        padding: "0.75rem",
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {task.number > 0 && (
        <span style={{ display: "inline-block", fontSize: "0.625rem", fontWeight: 600, color: "var(--app-text-muted)", background: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.25rem", padding: "0.1rem 0.3rem", marginBottom: "0.25rem", letterSpacing: "0.03em" }}>
          {taskCode(task.project.name, task.number)}
        </span>
      )}
      <p
        style={{
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "var(--app-body-text)",
          lineHeight: 1.35,
          marginBottom: "0.5rem",
        }}
      >
        {task.title}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <TaskPriorityBadge priority={task.priority as Priority} />
        {task.category && (
          <span style={{ fontSize: "0.6875rem", color: "var(--app-text-muted)" }}>
            {task.category}
          </span>
        )}
      </div>
      <div
        style={{
          marginTop: "0.5rem",
          fontSize: "0.6875rem",
          color: "var(--app-text-muted)",
          display: "flex",
          flexDirection: "column",
          gap: "0.125rem",
        }}
      >
        {task.assignedTo && (
          <span>Asignado: {task.assignedTo.name}</span>
        )}
        {task.dueDate && <span>Vence: {formatDate(task.dueDate)}</span>}
      </div>
    </div>
  );
}

function DraggableCard({
  task,
  projectId,
}: {
  task: TaskWithRelations;
  projectId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div ref={setNodeRef} style={{ ...style, position: "relative" }} className="group">
      <Link
        href={`/proyectos/${projectId}/tareas/${task.id}`}
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "0.5rem",
          zIndex: 10,
        }}
        tabIndex={-1}
        aria-label={task.title}
      />
      <div
        {...listeners}
        {...attributes}
        style={{
          position: "absolute",
          top: "0.5rem",
          right: "0.5rem",
          zIndex: 20,
          cursor: "grab",
          padding: "0.125rem",
          borderRadius: "0.25rem",
          color: "var(--app-text-muted)",
        }}
      >
        <GripVertical style={{ width: "1rem", height: "1rem" }} />
      </div>
      <Link
        href={`/proyectos/${projectId}/tareas/${task.id}`}
        style={{ display: "block", textDecoration: "none" }}
        tabIndex={0}
      >
        <TaskCard task={task} projectId={projectId} isDragging={isDragging} />
      </Link>
    </div>
  );
}

function KanbanColumn({
  col,
  tasks,
  projectId,
  isOver,
}: {
  col: (typeof columns)[number];
  tasks: TaskWithRelations[];
  projectId: string;
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: col.status });
  const Icon = col.icon;

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderTop: `4px solid ${col.borderColor}`,
        borderRadius: "0.75rem",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.75rem 1rem",
          borderBottom: "1px solid var(--app-border)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "var(--app-body-text)",
          }}
        >
          <Icon style={{ width: "1rem", height: "1rem", color: col.borderColor }} />
          {col.label}
        </div>
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 700,
            padding: "0.125rem 0.5rem",
            borderRadius: "9999px",
            backgroundColor: col.countBg,
            color: col.countColor,
          }}
        >
          {tasks.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          padding: "0.75rem",
          minHeight: "7.5rem",
          borderRadius: "0 0 0.75rem 0.75rem",
          backgroundColor: isOver ? "rgba(0,0,0,0.03)" : "transparent",
          transition: "background-color 0.15s",
        }}
      >
        {tasks.length === 0 ? (
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--app-text-muted)",
              textAlign: "center",
              padding: "1.5rem 0",
            }}
          >
            Sin tareas
          </p>
        ) : (
          tasks.map((task) => (
            <DraggableCard key={task.id} task={task} projectId={projectId} />
          ))
        )}
      </div>
    </div>
  );
}

export function TaskKanban({
  tasks: initialTasks,
  projectId,
}: {
  tasks: TaskWithRelations[];
  projectId: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TaskStatus | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const grouped = Object.fromEntries(
    columns.map((col) => [
      col.status,
      tasks.filter((t) => t.status === col.status),
    ])
  ) as Record<TaskStatus, TaskWithRelations[]>;

  const activeTask = activeId
    ? tasks.find((t) => t.id === activeId) ?? null
    : null;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragOver({ over }: { over: DragEndEvent["over"] }) {
    setOverColumn(over ? (over.id as TaskStatus) : null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setOverColumn(null);

    if (!over) return;

    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === active.id);
    if (!task || task.status === newStatus) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );

    startTransition(async () => {
      const result = await updateTaskStatus(task.id, projectId, newStatus);
      if (result?.error) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: task.status } : t))
        );
      }
    });
  }

  return (
    <DndContext
      id="task-kanban-board"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          alignItems: "start",
        }}
      >
        {columns.map((col) => (
          <KanbanColumn
            key={col.status}
            col={col}
            tasks={grouped[col.status]}
            projectId={projectId}
            isOver={overColumn === col.status}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
        {activeTask && (
          <div style={{ transform: "rotate(1deg)", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", borderRadius: "0.5rem" }}>
            <TaskCard task={activeTask} projectId={projectId} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
