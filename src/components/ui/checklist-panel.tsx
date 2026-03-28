"use client";

import { useState, useEffect, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";
import {
  addTicketChecklistItem,
  toggleTicketChecklistItem,
  deleteTicketChecklistItem,
} from "@/actions/checklist.actions";
import {
  addTaskChecklistItem,
  toggleTaskChecklistItem,
  deleteTaskChecklistItem,
} from "@/actions/checklist.actions";

type Item = { id: string; title: string; isChecked: boolean };

// ─── Shared UI ────────────────────────────────────────────────────────────────

function ChecklistUI({
  items,
  canDelete,
  onToggle,
  onDelete,
  onAdd,
}: {
  items: Item[];
  canDelete: boolean;
  onToggle: (item: Item) => void;
  onDelete: (id: string) => void;
  onAdd: (title: string) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const total   = items.length;
  const checked = items.filter((i) => i.isChecked).length;
  const pct     = total > 0 ? Math.round((checked / total) * 100) : 0;
  const done    = total > 0 && checked === total;

  function handleAdd() {
    const t = newTitle.trim();
    if (!t) return;
    setNewTitle("");
    setAddOpen(false);
    onAdd(t);
  }

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        padding: "1.5rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: total > 0 ? "0.75rem" : "1rem" }}>
        <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)", margin: 0 }}>
          Checklist
        </h2>
        {total > 0 && (
          <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: done ? "#16a34a" : "var(--app-text-muted)" }}>
            {checked}/{total}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ height: "0.375rem", backgroundColor: "var(--app-border)", borderRadius: "9999px", marginBottom: "1rem", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              backgroundColor: done ? "#22c55e" : "#fd1384",
              borderRadius: "9999px",
              transition: "width 0.25s ease, background-color 0.25s ease",
            }}
          />
        </div>
      )}

      {/* Items */}
      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
          {items.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              <button
                type="button"
                onClick={() => onToggle(item)}
                style={{
                  flexShrink: 0,
                  width: "1.125rem",
                  height: "1.125rem",
                  borderRadius: "0.25rem",
                  border: item.isChecked ? "2px solid #22c55e" : "2px solid rgba(128,128,128,0.4)",
                  backgroundColor: item.isChecked ? "#22c55e" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background-color 0.15s",
                  padding: 0,
                }}
              >
                {item.isChecked && <Check style={{ width: "0.75rem", height: "0.75rem", color: "#fff", strokeWidth: 3 }} />}
              </button>
              <span
                style={{
                  flex: 1,
                  fontSize: "0.875rem",
                  color: item.isChecked ? "var(--app-text-muted)" : "var(--app-body-text)",
                  textDecoration: item.isChecked ? "line-through" : "none",
                  transition: "color 0.15s",
                  wordBreak: "break-word",
                }}
              >
                {item.title}
              </span>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  title="Eliminar ítem"
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    color: "var(--app-text-muted)",
                    cursor: "pointer",
                    padding: "0.125rem",
                    borderRadius: "0.25rem",
                    background: "none",
                    border: "none",
                    opacity: 0.5,
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
                >
                  <X style={{ width: "0.875rem", height: "0.875rem" }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add item */}
      {addOpen ? (
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            autoFocus
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") { setAddOpen(false); setNewTitle(""); }
            }}
            placeholder="Nuevo ítem…"
            maxLength={200}
            style={{
              flex: 1,
              fontSize: "0.875rem",
              padding: "0.375rem 0.625rem",
              border: "1px solid var(--app-border)",
              borderRadius: "0.375rem",
              backgroundColor: "var(--app-card-bg)",
              color: "var(--app-body-text)",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newTitle.trim()}
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "#fff",
              backgroundColor: newTitle.trim() ? "#fd1384" : "#f9a8d4",
              border: "none",
              borderRadius: "0.375rem",
              padding: "0.375rem 0.75rem",
              cursor: newTitle.trim() ? "pointer" : "not-allowed",
              whiteSpace: "nowrap",
            }}
          >
            Agregar
          </button>
          <button
            type="button"
            onClick={() => { setAddOpen(false); setNewTitle(""); }}
            style={{ display: "flex", alignItems: "center", color: "var(--app-text-muted)", cursor: "pointer", background: "none", border: "none" }}
          >
            <X style={{ width: "1rem", height: "1rem" }} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "#fd1384",
            cursor: "pointer",
            background: "none",
            border: "none",
            padding: 0,
          }}
        >
          <Plus style={{ width: "0.875rem", height: "0.875rem" }} />
          Agregar ítem
        </button>
      )}
    </div>
  );
}

// ─── Ticket Checklist ─────────────────────────────────────────────────────────

export function TicketChecklistPanel({
  ticketId,
  initialItems,
  canDelete,
}: {
  ticketId: string;
  initialItems: Item[];
  canDelete: boolean;
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [, startTransition] = useTransition();

  useEffect(() => { setItems(initialItems); }, [initialItems]);

  function handleToggle(item: Item) {
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isChecked: !i.isChecked } : i));
    startTransition(async () => {
      await toggleTicketChecklistItem(item.id, ticketId);
    });
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      await deleteTicketChecklistItem(id, ticketId);
    });
  }

  function handleAdd(title: string) {
    const tempItem: Item = { id: `temp-${Date.now()}`, title, isChecked: false };
    setItems((prev) => [...prev, tempItem]);
    startTransition(async () => {
      await addTicketChecklistItem(ticketId, title);
    });
  }

  return (
    <ChecklistUI
      items={items}
      canDelete={canDelete}
      onToggle={handleToggle}
      onDelete={handleDelete}
      onAdd={handleAdd}
    />
  );
}

// ─── Task Checklist ───────────────────────────────────────────────────────────

export function TaskChecklistPanel({
  taskId,
  projectId,
  initialItems,
  canDelete,
}: {
  taskId: string;
  projectId: string;
  initialItems: Item[];
  canDelete: boolean;
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [, startTransition] = useTransition();

  useEffect(() => { setItems(initialItems); }, [initialItems]);

  function handleToggle(item: Item) {
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, isChecked: !i.isChecked } : i));
    startTransition(async () => {
      await toggleTaskChecklistItem(item.id, taskId, projectId);
    });
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    startTransition(async () => {
      await deleteTaskChecklistItem(id, taskId, projectId);
    });
  }

  function handleAdd(title: string) {
    const tempItem: Item = { id: `temp-${Date.now()}`, title, isChecked: false };
    setItems((prev) => [...prev, tempItem]);
    startTransition(async () => {
      await addTaskChecklistItem(taskId, projectId, title);
    });
  }

  return (
    <ChecklistUI
      items={items}
      canDelete={canDelete}
      onToggle={handleToggle}
      onDelete={handleDelete}
      onAdd={handleAdd}
    />
  );
}
