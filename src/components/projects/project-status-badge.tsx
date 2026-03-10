import type { ProjectStatus, TaskStatus, Priority } from "@/generated/prisma";
import {
  Clock,
  Code2,
  Eye,
  CheckCircle2,
  PauseCircle,
  Circle,
  ArrowDown,
  Minus,
  ArrowUp,
  Zap,
} from "lucide-react";

const projectStatusConfig: Record<
  ProjectStatus,
  { label: string; bg: string; color: string; icon: React.ElementType }
> = {
  PLANIFICACION: {
    label: "Planificación",
    bg: "#eff6ff",
    color: "#1d4ed8",
    icon: Clock,
  },
  EN_DESARROLLO: {
    label: "En desarrollo",
    bg: "#fffbeb",
    color: "#b45309",
    icon: Code2,
  },
  EN_REVISION: {
    label: "En revisión",
    bg: "#faf5ff",
    color: "#7e22ce",
    icon: Eye,
  },
  COMPLETADO: {
    label: "Completado",
    bg: "#f0fdf4",
    color: "#15803d",
    icon: CheckCircle2,
  },
  PAUSADO: {
    label: "Pausado",
    bg: "#f9fafb",
    color: "#6b7280",
    icon: PauseCircle,
  },
};

const taskStatusConfig: Record<
  TaskStatus,
  { label: string; bg: string; color: string; icon: React.ElementType }
> = {
  PENDIENTE: {
    label: "Pendiente",
    bg: "#f9fafb",
    color: "#6b7280",
    icon: Circle,
  },
  EN_PROGRESO: {
    label: "En progreso",
    bg: "#eff6ff",
    color: "#1d4ed8",
    icon: Clock,
  },
  EN_REVISION: {
    label: "En revisión",
    bg: "#faf5ff",
    color: "#7e22ce",
    icon: Eye,
  },
  COMPLETADO: {
    label: "Completado",
    bg: "#f0fdf4",
    color: "#15803d",
    icon: CheckCircle2,
  },
};

const priorityConfig: Record<
  Priority,
  { label: string; bg: string; color: string; icon: React.ElementType }
> = {
  BAJA: { label: "Baja", bg: "#f9fafb", color: "#6b7280", icon: ArrowDown },
  MEDIA: { label: "Media", bg: "#eff6ff", color: "#1d4ed8", icon: Minus },
  ALTA: {
    label: "Alta",
    bg: "#fff7ed",
    color: "#c2410c",
    icon: ArrowUp,
  },
  CRITICA: { label: "Crítica", bg: "#fef2f2", color: "#b91c1c", icon: Zap },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { label, bg, color, icon: Icon } = projectStatusConfig[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.125rem 0.5rem",
        borderRadius: "0.25rem",
        fontSize: "0.75rem",
        fontWeight: 500,
        backgroundColor: bg,
        color,
      }}
    >
      <Icon style={{ width: "0.75rem", height: "0.75rem" }} />
      {label}
    </span>
  );
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const { label, bg, color, icon: Icon } = taskStatusConfig[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.125rem 0.5rem",
        borderRadius: "0.25rem",
        fontSize: "0.75rem",
        fontWeight: 500,
        backgroundColor: bg,
        color,
      }}
    >
      <Icon style={{ width: "0.75rem", height: "0.75rem" }} />
      {label}
    </span>
  );
}

export function TaskPriorityBadge({ priority }: { priority: Priority }) {
  const { label, bg, color, icon: Icon } = priorityConfig[priority];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        padding: "0.125rem 0.5rem",
        borderRadius: "0.25rem",
        fontSize: "0.75rem",
        fontWeight: 500,
        backgroundColor: bg,
        color,
      }}
    >
      <Icon style={{ width: "0.75rem", height: "0.75rem" }} />
      {label}
    </span>
  );
}
