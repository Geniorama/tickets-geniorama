"use client";
import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { configureTicket } from "@/actions/ticket.actions";

interface Collaborator { id: string; name: string; }

export function TicketAssignPanel({
  ticketId,
  collaborators,
  currentPriority,
  currentDueDate,
  currentAssignedToId,
}: {
  ticketId: string;
  collaborators: Collaborator[];
  currentPriority: string;
  currentDueDate: Date | null;
  currentAssignedToId: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const defaultDate = currentDueDate
    ? new Date(currentDueDate).toISOString().split("T")[0]
    : "";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await configureTicket(ticketId, fd);
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  const selectStyle = {
    width: "100%",
    border: "1px solid var(--app-border)",
    borderRadius: "0.5rem",
    padding: "0.4rem 0.625rem",
    fontSize: "0.875rem",
    color: "var(--app-body-text)",
    backgroundColor: "var(--app-input-bg, var(--app-card-bg))",
    outline: "none",
  };

  return (
    <div style={{
      backgroundColor: "var(--app-card-bg)",
      border: "2px solid #f59e0b",
      borderRadius: "0.75rem",
      overflow: "hidden",
    }}>
      {/* Banner */}
      <div style={{ backgroundColor: "rgba(245,158,11,0.1)", padding: "0.875rem 1.25rem", display: "flex", alignItems: "center", gap: "0.625rem", borderBottom: "1px solid rgba(245,158,11,0.3)" }}>
        <AlertTriangle style={{ width: "1rem", height: "1rem", color: "#d97706", flexShrink: 0 }} />
        <p style={{ fontSize: "0.875rem", fontWeight: 600, color: "#92400e" }}>
          Ticket pendiente de configuración — asigna los datos antes de activarlo
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--app-text-muted)", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Asignado a
            </label>
            <select name="assignedToId" defaultValue={currentAssignedToId ?? ""} style={selectStyle}>
              <option value="">Sin asignar</option>
              {collaborators.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--app-text-muted)", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Fecha límite
            </label>
            <input
              type="date"
              name="dueDate"
              defaultValue={defaultDate}
              style={{ ...selectStyle }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--app-text-muted)", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Prioridad
            </label>
            <select name="priority" defaultValue={currentPriority} style={selectStyle}>
              <option value="BAJA">Baja</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
              <option value="CRITICA">Crítica</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "var(--app-text-muted)", marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Activar como
            </label>
            <select name="status" defaultValue="ABIERTO" style={selectStyle}>
              <option value="ABIERTO">Abierto</option>
              <option value="EN_PROGRESO">En progreso</option>
              <option value="POR_ASIGNAR">Dejar pendiente</option>
            </select>
          </div>
        </div>

        {error && (
          <p style={{ fontSize: "0.8125rem", color: "#dc2626", backgroundColor: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "0.5rem", padding: "0.5rem 0.75rem" }}>
            {error}
          </p>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            type="submit"
            disabled={isPending}
            style={{
              backgroundColor: "#d97706",
              color: "#fff",
              border: "none",
              borderRadius: "0.5rem",
              padding: "0.5rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? "Guardando..." : "Configurar ticket"}
          </button>
          {saved && (
            <span style={{ fontSize: "0.8125rem", color: "#16a34a", fontWeight: 500 }}>
              ✓ Configurado correctamente
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
