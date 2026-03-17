import type { TicketStatus, Priority } from "@/generated/prisma";
import { Circle, Clock, Eye, CheckCircle2, ArrowDown, Minus, ArrowUp, Zap, Inbox } from "lucide-react";

const statusConfig: Record<TicketStatus, { label: string; className: string; icon: React.ElementType }> = {
  POR_ASIGNAR: { label: "Por asignar",  className: "bg-gray-100 text-gray-600 border-gray-300",     icon: Inbox },
  ABIERTO:     { label: "Abierto",      className: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Circle },
  EN_PROGRESO: { label: "En progreso",  className: "bg-blue-50 text-blue-700 border-blue-200",       icon: Clock },
  EN_REVISION: { label: "En revisión",  className: "bg-purple-50 text-purple-700 border-purple-200", icon: Eye },
  CERRADO:     { label: "Cerrado",      className: "bg-green-50 text-green-700 border-green-200",    icon: CheckCircle2 },
};

const priorityConfig: Record<Priority, { label: string; className: string; icon: React.ElementType }> = {
  BAJA:    { label: "Baja",    className: "bg-gray-50 text-gray-600 border-gray-200",       icon: ArrowDown },
  MEDIA:   { label: "Media",   className: "bg-blue-50 text-blue-700 border-blue-200",       icon: Minus },
  ALTA:    { label: "Alta",    className: "bg-orange-50 text-orange-700 border-orange-200", icon: ArrowUp },
  CRITICA: { label: "Crítica", className: "bg-red-50 text-red-700 border-red-200",          icon: Zap },
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
