import type { TaskStatus, Priority } from "@/generated/prisma";
import { projectState, PROJECT_STATE_LABEL, type ProjectState } from "@/lib/project-state";
import {
  Clock,
  FilePen,
  Eye,
  CheckCircle2,
  PauseCircle,
  Circle,
  ArrowDown,
  Minus,
  ArrowUp,
  Zap,
} from "lucide-react";

/** Tonos que cambian con el tema (definidos en globals.css). */
const tone = (n: string) => `var(--tone-${n}-bg)`;
const toneFg = (n: string) => `var(--tone-${n}-fg)`;

const projectStateConfig: Record<
  ProjectState,
  { bg: string; color: string; icon: React.ElementType }
> = {
  ACTIVO:   { bg: tone("green"), color: toneFg("green"), icon: CheckCircle2 },
  INACTIVO: { bg: tone("gray"),  color: toneFg("gray"),  icon: PauseCircle },
  BORRADOR: { bg: tone("amber"), color: toneFg("amber"), icon: FilePen },
};

const taskStatusConfig: Record<
  TaskStatus,
  { label: string; bg: string; color: string; icon: React.ElementType }
> = {
  PENDIENTE: {
    label: "Pendiente",
    bg: tone("gray"),
    color: toneFg("gray"),
    icon: Circle,
  },
  EN_PROGRESO: {
    label: "En progreso",
    bg: tone("blue"),
    color: toneFg("blue"),
    icon: Clock,
  },
  EN_REVISION: {
    label: "En revisión",
    bg: tone("purple"),
    color: toneFg("purple"),
    icon: Eye,
  },
  COMPLETADO: {
    label: "Completado",
    bg: tone("green"),
    color: toneFg("green"),
    icon: CheckCircle2,
  },
};

const priorityConfig: Record<
  Priority,
  { label: string; bg: string; color: string; icon: React.ElementType }
> = {
  // Escala de intensidad: neutro → naranja → rojo (no repite los colores de estado).
  BAJA: { label: "Baja", bg: "transparent", color: toneFg("gray"), icon: ArrowDown },
  MEDIA: { label: "Media", bg: tone("slate"), color: toneFg("slate"), icon: Minus },
  ALTA: {
    label: "Alta",
    bg: tone("orange"),
    color: toneFg("orange"),
    icon: ArrowUp,
  },
  CRITICA: { label: "Crítica", bg: tone("red"), color: toneFg("red"), icon: Zap },
};

/** Activo, Inactivo o Borrador, derivado de isActive e isDraft. */
export function ProjectStatusBadge({ project }: { project: { isActive: boolean; isDraft: boolean } }) {
  const state = projectState(project);
  const { bg, color, icon: Icon } = projectStateConfig[state];
  const label = PROJECT_STATE_LABEL[state];
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
