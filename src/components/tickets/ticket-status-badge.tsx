import type { TicketStatus, Priority } from "@/generated/prisma";
import { Circle, Clock, Eye, CheckCircle2, ArrowDown, Minus, ArrowUp, Zap, Inbox } from "lucide-react";

const statusConfig: Record<TicketStatus, { label: string; className: string; icon: React.ElementType }> = {
  POR_ASIGNAR: { label: "Por asignar",  className: "bg-[var(--tone-gray-bg)] text-[var(--tone-gray-fg)] border-[var(--tone-gray-bd)]",       icon: Inbox },
  ABIERTO:     { label: "Abierto",      className: "bg-[var(--tone-amber-bg)] text-[var(--tone-amber-fg)] border-[var(--tone-amber-bd)]",    icon: Circle },
  EN_PROGRESO: { label: "En progreso",  className: "bg-[var(--tone-blue-bg)] text-[var(--tone-blue-fg)] border-[var(--tone-blue-bd)]",        icon: Clock },
  EN_REVISION: { label: "En revisión",  className: "bg-[var(--tone-purple-bg)] text-[var(--tone-purple-fg)] border-[var(--tone-purple-bd)]", icon: Eye },
  CERRADO:     { label: "Cerrado",      className: "bg-[var(--tone-green-bg)] text-[var(--tone-green-fg)] border-[var(--tone-green-bd)]",    icon: CheckCircle2 },
};

/* Prioridad = escala de intensidad (neutro → naranja → rojo), sin repetir los
   colores de estado: así, estado y prioridad juntos no se confunden. */
const priorityConfig: Record<Priority, { label: string; className: string; icon: React.ElementType }> = {
  BAJA:    { label: "Baja",    className: "bg-transparent text-[var(--tone-gray-fg)] border-[var(--tone-gray-bd)]",                          icon: ArrowDown },
  MEDIA:   { label: "Media",   className: "bg-[var(--tone-slate-bg)] text-[var(--tone-slate-fg)] border-[var(--tone-slate-bd)]",              icon: Minus },
  ALTA:    { label: "Alta",    className: "bg-[var(--tone-orange-bg)] text-[var(--tone-orange-fg)] border-[var(--tone-orange-bd)]",           icon: ArrowUp },
  CRITICA: { label: "Crítica", className: "bg-[var(--tone-red-bg)] text-[var(--tone-red-fg)] border-[var(--tone-red-bd)] font-semibold",      icon: Zap },
};

export function StatusBadge({ status }: { status: TicketStatus }) {
  const { label, className, icon: Icon } = statusConfig[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, className, icon: Icon } = priorityConfig[priority];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${className}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}
