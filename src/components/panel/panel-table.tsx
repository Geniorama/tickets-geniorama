"use client";

import Link from "next/link";
import type { TicketStatus, TaskStatus, Priority } from "@/generated/prisma";
import type { PanelItem } from "@/lib/panel";
import { StatusBadge as TicketStatusBadge } from "@/components/tickets/ticket-status-badge";
import { TaskStatusBadge, TaskPriorityBadge } from "@/components/projects/project-status-badge";
import { SortableHeader } from "@/components/ui/sortable-header";
import { formatDate } from "@/lib/format-date";
import { isOverdue } from "@/lib/overdue";
import { Ticket, ListTodo, Inbox } from "lucide-react";

function KindBadge({ kind }: { kind: PanelItem["kind"] }) {
  const isTicket = kind === "ticket";
  const Icon = isTicket ? Ticket : ListTodo;
  const color = isTicket ? "#6366f1" : "#0ea5e9";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        fontSize: "0.6875rem",
        fontWeight: 600,
        padding: "0.15rem 0.5rem",
        borderRadius: "0.25rem",
        backgroundColor: `${color}15`,
        color,
        whiteSpace: "nowrap",
      }}
    >
      <Icon style={{ width: "0.75rem", height: "0.75rem" }} />
      {isTicket ? "Ticket" : "Tarea"}
    </span>
  );
}

function ItemStatus({ item }: { item: PanelItem }) {
  return item.kind === "ticket" ? (
    <TicketStatusBadge status={item.status as TicketStatus} />
  ) : (
    <TaskStatusBadge status={item.status as TaskStatus} />
  );
}

export function PanelTable({
  items,
  sortBy,
  sortDir,
  paramsStr,
}: {
  items: PanelItem[];
  sortBy: string;
  sortDir: string;
  paramsStr: string;
}) {
  const sharedProps = { sortBy, sortDir, basePath: "/panel", paramsStr };

  const container: React.CSSProperties = {
    backgroundColor: "var(--app-card-bg)",
    border: "1px solid var(--app-border)",
    borderRadius: "0.75rem",
    overflow: "hidden",
  };

  if (items.length === 0) {
    return (
      <div style={{ ...container, padding: "3rem", textAlign: "center" }}>
        <Inbox style={{ width: "2.5rem", height: "2.5rem", color: "var(--app-text-muted)", margin: "0 auto 0.75rem" }} />
        <p style={{ color: "var(--app-text-muted)", fontSize: "0.875rem" }}>
          No hay tickets ni tareas con estos filtros.
        </p>
      </div>
    );
  }

  const codeChip: React.CSSProperties = {
    fontSize: "0.6875rem",
    fontWeight: 600,
    color: "var(--app-text-muted)",
    background: "var(--app-content-bg)",
    border: "1px solid var(--app-border)",
    borderRadius: "0.25rem",
    padding: "0.1rem 0.35rem",
    letterSpacing: "0.03em",
    whiteSpace: "nowrap",
  };

  return (
    <div style={container}>
      {/* ── Mobile: cards ── */}
      <ul className="md:hidden divide-y" style={{ borderColor: "var(--app-border)" }}>
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}`}>
            <Link href={item.href} style={{ display: "block", padding: "0.875rem 1rem", textDecoration: "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.375rem" }}>
                <span style={{ fontWeight: 600, color: "var(--app-body-text)", fontSize: "0.875rem", lineHeight: 1.4 }}>
                  <span style={{ ...codeChip, marginRight: "0.375rem" }}>{item.code}</span>
                  {item.title}
                </span>
                <TaskPriorityBadge priority={item.priority as Priority} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", marginBottom: "0.375rem", alignItems: "center" }}>
                <KindBadge kind={item.kind} />
                <ItemStatus item={item} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                {item.context && <span>{item.context}</span>}
                {item.assignedTo && <span>→ {item.assignedTo}</span>}
                {item.dueDate && (
                  <span style={isOverdue(item.dueDate, item.status) ? { color: "var(--color-red-600)", fontWeight: 600 } : undefined}>
                    Vence: {formatDate(item.dueDate)}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* ── Desktop: tabla ── */}
      <div className="hidden md:block overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--app-content-bg)", borderBottom: "1px solid var(--app-border)" }}>
              <SortableHeader label="Tipo" column="kind" {...sharedProps} />
              <SortableHeader label="Código" column="code" {...sharedProps} />
              <SortableHeader label="Título" column="title" {...sharedProps} />
              <SortableHeader label="Estado" column="status" {...sharedProps} />
              <SortableHeader label="Prioridad" column="priority" {...sharedProps} />
              <SortableHeader label="Responsable" column="assignedTo" {...sharedProps} />
              <SortableHeader label="Vence" column="dueDate" {...sharedProps} />
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={`${item.kind}-${item.id}`} style={{ borderBottom: i < items.length - 1 ? "1px solid var(--app-border)" : "none" }}>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <KindBadge kind={item.kind} />
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <span style={codeChip}>{item.code}</span>
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <Link
                    href={item.href}
                    style={{ fontWeight: 500, color: "var(--app-body-text)", textDecoration: "none" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#fd1384")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "var(--app-body-text)")}
                  >
                    {item.title}
                  </Link>
                  {item.context && (
                    <span style={{ display: "block", fontSize: "0.6875rem", color: "var(--app-text-muted)", marginTop: "0.15rem" }}>
                      {item.context}
                    </span>
                  )}
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <ItemStatus item={item} />
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <TaskPriorityBadge priority={item.priority as Priority} />
                </td>
                <td style={{ padding: "0.75rem 1rem", color: "var(--app-text-muted)" }}>
                  {item.assignedTo ?? "—"}
                </td>
                <td
                  style={{
                    padding: "0.75rem 1rem",
                    whiteSpace: "nowrap",
                    color: isOverdue(item.dueDate, item.status) ? "var(--color-red-600)" : "var(--app-text-muted)",
                    fontWeight: isOverdue(item.dueDate, item.status) ? 600 : undefined,
                  }}
                >
                  {item.dueDate ? formatDate(item.dueDate) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
