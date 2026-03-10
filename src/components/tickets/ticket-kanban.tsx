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
import type { Ticket, TicketStatus, Priority } from "@/generated/prisma";
import { PriorityBadge } from "./ticket-status-badge";
import { formatDateTime } from "@/lib/format-date";
import { updateTicketStatus } from "@/actions/ticket.actions";

type TicketWithRelations = Ticket & {
  createdBy: { name: string; companies: { name: string }[] };
  assignedTo: { name: string } | null;
};

const columns: {
  status: TicketStatus;
  label: string;
  icon: React.ElementType;
  topBorder: string;
  countClass: string;
  dropClass: string;
  dropActiveClass: string;
}[] = [
  {
    status: "ABIERTO",
    label: "Abierto",
    icon: Circle,
    topBorder: "border-t-yellow-400",
    countClass: "bg-yellow-100 text-yellow-700",
    dropClass: "bg-white",
    dropActiveClass: "bg-yellow-50 ring-2 ring-yellow-300",
  },
  {
    status: "EN_PROGRESO",
    label: "En progreso",
    icon: Clock,
    topBorder: "border-t-blue-400",
    countClass: "bg-blue-100 text-blue-700",
    dropClass: "bg-white",
    dropActiveClass: "bg-blue-50 ring-2 ring-blue-300",
  },
  {
    status: "EN_REVISION",
    label: "En revisión",
    icon: Eye,
    topBorder: "border-t-purple-400",
    countClass: "bg-purple-100 text-purple-700",
    dropClass: "bg-white",
    dropActiveClass: "bg-purple-50 ring-2 ring-purple-300",
  },
  {
    status: "CERRADO",
    label: "Cerrado",
    icon: CheckCircle2,
    topBorder: "border-t-green-400",
    countClass: "bg-green-100 text-green-700",
    dropClass: "bg-white",
    dropActiveClass: "bg-green-50 ring-2 ring-green-300",
  },
];

// ─── Card ────────────────────────────────────────────────────────────────────

function TicketCard({
  ticket,
  isDragging = false,
}: {
  ticket: TicketWithRelations;
  isDragging?: boolean;
}) {
  return (
    <div
      className={`bg-gray-50 border border-gray-200 rounded-lg p-3 transition-shadow ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <p className="text-sm font-medium text-gray-800 leading-snug mb-2">
        {ticket.title}
      </p>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <PriorityBadge priority={ticket.priority as Priority} />
        {ticket.category && (
          <span className="text-xs text-gray-400">{ticket.category}</span>
        )}
      </div>
      <div className="mt-2 text-xs text-gray-400 space-y-0.5">
        {ticket.assignedTo && (
          <p>
            Asignado:{" "}
            <span className="text-gray-500">{ticket.assignedTo.name}</span>
          </p>
        )}
        <p>{formatDateTime(ticket.createdAt)}</p>
      </div>
    </div>
  );
}

// ─── Draggable card ──────────────────────────────────────────────────────────

function DraggableCard({ ticket }: { ticket: TicketWithRelations }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: ticket.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Grip handle — click goes to detail, drag reorders */}
      <Link
        href={`/tickets/${ticket.id}`}
        className="absolute inset-0 rounded-lg z-10"
        tabIndex={-1}
        aria-label={ticket.title}
      />
      <div
        {...listeners}
        {...attributes}
        className="absolute top-2 right-2 z-20 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-gray-400 hover:text-gray-600"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <Link
        href={`/tickets/${ticket.id}`}
        className="block hover:border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400"
        tabIndex={0}
      >
        <TicketCard ticket={ticket} isDragging={isDragging} />
      </Link>
    </div>
  );
}

// ─── Droppable column ────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  tickets,
  isOver,
}: {
  col: (typeof columns)[number];
  tickets: TicketWithRelations[];
  isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: col.status });
  const Icon = col.icon;

  return (
    <div
      className={`rounded-xl border border-gray-200 border-t-4 ${col.topBorder} flex flex-col transition-shadow`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Icon className="w-4 h-4" />
          {col.label}
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.countClass}`}>
          {tickets.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 p-3 min-h-[120px] rounded-b-xl transition-colors ${
          isOver ? col.dropActiveClass : col.dropClass
        }`}
      >
        {tickets.length === 0 ? (
          <p className="text-xs text-gray-300 text-center py-6">Sin tickets</p>
        ) : (
          tickets.map((ticket) => (
            <DraggableCard key={ticket.id} ticket={ticket} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Board ───────────────────────────────────────────────────────────────────

export function TicketKanban({ tickets: initialTickets }: { tickets: TicketWithRelations[] }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<TicketStatus | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const grouped = Object.fromEntries(
    columns.map((col) => [
      col.status,
      tickets.filter((t) => t.status === col.status),
    ])
  ) as Record<TicketStatus, TicketWithRelations[]>;

  const activeTicket = activeId ? tickets.find((t) => t.id === activeId) ?? null : null;

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
  }

  function handleDragOver({ over }: { over: DragEndEvent["over"] }) {
    setOverColumn(over ? (over.id as TicketStatus) : null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setOverColumn(null);

    if (!over) return;

    const newStatus = over.id as TicketStatus;
    const ticket = tickets.find((t) => t.id === active.id);
    if (!ticket || ticket.status === newStatus) return;

    // Optimistic update
    setTickets((prev) =>
      prev.map((t) => (t.id === ticket.id ? { ...t, status: newStatus } : t))
    );

    startTransition(async () => {
      const result = await updateTicketStatus(ticket.id, newStatus);
      if (result?.error) {
        // Revert on error
        setTickets((prev) =>
          prev.map((t) => (t.id === ticket.id ? { ...t, status: ticket.status } : t))
        );
      }
    });
  }

  return (
    <DndContext
      id="kanban-board"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {columns.map((col) => (
          <KanbanColumn
            key={col.status}
            col={col}
            tickets={grouped[col.status]}
            isOver={overColumn === col.status}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
        {activeTicket && (
          <div className="rotate-1 shadow-xl opacity-95 rounded-lg">
            <TicketCard ticket={activeTicket} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
