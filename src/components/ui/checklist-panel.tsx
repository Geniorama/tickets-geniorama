"use client";

import { useState, useOptimistic, useTransition } from "react";
import { Check, Plus, X } from "lucide-react";

type Item = { id: string; title: string; isChecked: boolean };

type OptimisticAction =
  | { type: "toggle"; id: string }
  | { type: "delete"; id: string }
  | { type: "add"; item: Item };

function reducer(state: Item[], action: OptimisticAction): Item[] {
  switch (action.type) {
    case "toggle":
      return state.map((i) => i.id === action.id ? { ...i, isChecked: !i.isChecked } : i);
    case "delete":
      return state.filter((i) => i.id !== action.id);
    case "add":
      return [...state, action.item];
  }
}

interface ChecklistPanelProps {
  items: Item[];
  addFn: (title: string) => Promise<{ error?: string } | void>;
  toggleFn: (itemId: string) => Promise<{ error?: string } | void>;
  deleteFn: (itemId: string) => Promise<{ error?: string } | void>;
  canDelete: boolean;
}

export function ChecklistPanel({ items, addFn, toggleFn, deleteFn, canDelete }: ChecklistPanelProps) {
  const [optimistic, dispatch] = useOptimistic(items, reducer);
  const [newTitle, setNewTitle] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [, startTransition] = useTransition();

  const total   = optimistic.length;
  const checked = optimistic.filter((i) => i.isChecked).length;
  const pct     = total > 0 ? Math.round((checked / total) * 100) : 0;
  const done    = total > 0 && checked === total;

  function handleToggle(item: Item) {
    startTransition(async () => {
      dispatch({ type: "toggle", id: item.id });
      await toggleFn(item.id);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      dispatch({ type: "delete", id });
      await deleteFn(id);
    });
  }

  function handleAdd() {
    const title = newTitle.trim();
    if (!title) return;
    setNewTitle("");
    setAddOpen(false);
    startTransition(async () => {
      dispatch({ type: "add", item: { id: `temp-${Date.now()}`, title, isChecked: false } });
      await addFn(title);
    });
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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: total > 0 ? "0.75rem" : "1rem",
        }}
      >
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
        <div
          style={{
            height: "0.375rem",
            backgroundColor: "var(--app-border)",
            borderRadius: "9999px",
            marginBottom: "1rem",
            overflow: "hidden",
          }}
        >
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
      {optimistic.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
          {optimistic.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
              {/* Checkbox */}
              <button
                onClick={() => handleToggle(item)}
                style={{
                  flexShrink: 0,
                  width: "1.125rem",
                  height: "1.125rem",
                  borderRadius: "0.25rem",
                  border: item.isChecked ? "2px solid #22c55e" : "2px solid var(--app-border)",
                  backgroundColor: item.isChecked ? "#22c55e" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "border-color 0.15s, background-color 0.15s",
                  padding: 0,
                }}
              >
                {item.isChecked && (
                  <Check style={{ width: "0.75rem", height: "0.75rem", color: "#fff", strokeWidth: 3 }} />
                )}
              </button>

              {/* Label */}
              <span
                style={{
                  flex: 1,
                  fontSize: "0.875rem",
                  color: item.isChecked ? "var(--app-text-muted)" : "var(--app-body-text)",
                  textDecoration: item.isChecked ? "line-through" : "none",
                  transition: "color 0.15s, text-decoration 0.15s",
                  wordBreak: "break-word",
                }}
              >
                {item.title}
              </span>

              {/* Delete */}
              {canDelete && (
                <button
                  onClick={() => handleDelete(item.id)}
                  title="Eliminar ítem"
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    color: "var(--app-text-muted)",
                    cursor: "pointer",
                    padding: "0.125rem",
                    borderRadius: "0.25rem",
                    opacity: 0.6,
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
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
            onClick={() => { setAddOpen(false); setNewTitle(""); }}
            style={{ display: "flex", alignItems: "center", color: "var(--app-text-muted)", cursor: "pointer" }}
          >
            <X style={{ width: "1rem", height: "1rem" }} />
          </button>
        </div>
      ) : (
        <button
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
