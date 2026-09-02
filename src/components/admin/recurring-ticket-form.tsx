"use client";

/**
 * Alta y edición de un ticket recurrente.
 *
 * Hermano de `recurring-task-form`, con los campos de un ticket: cliente, plan
 * y sitio en vez de proyecto. El patrón de repetición no se escribe aquí —lo
 * pone `RecurrenceFields`, compartido con las tareas—, así que este archivo solo
 * se ocupa de qué ticket se abre, no de cuándo.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Trash2, Play } from "lucide-react";
import { DraftChecklist } from "@/components/ui/draft-checklist";
import { RecurrenceFields, type RecurrenceValue } from "@/components/ui/recurrence-fields";
import type { ChecklistGroup } from "@/lib/checklist";
import { TICKET_CATEGORIES } from "@/lib/ticket-categories";
import {
  createRecurringTicket,
  updateRecurringTicket,
  deleteRecurringTicket,
  runRecurringTicketNow,
} from "@/actions/recurring-ticket.actions";

type Option = { id: string; name: string };
export type PlanOption = { id: string; name: string; companyName: string };
export type SiteOption = { id: string; name: string; companyName: string };

export type RecurringTicketFormData = RecurrenceValue & {
  id?: string;
  title: string;
  description: string;
  priority: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  category: string | null;
  checklist: ChecklistGroup[];
  clientId: string | null;
  planId: string | null;
  siteId: string | null;
  assignedToId: string | null;
  reviewerIds: string[];
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  border: "1px solid var(--app-border)",
  borderRadius: "0.5rem",
  fontSize: "0.875rem",
  backgroundColor: "var(--app-content-bg)",
  color: "var(--app-body-text)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "var(--app-nav-text)",
  marginBottom: "0.375rem",
};

const sectionStyle: React.CSSProperties = {
  backgroundColor: "var(--app-card-bg)",
  border: "1px solid var(--app-border)",
  borderRadius: "0.75rem",
  padding: "1.25rem",
  marginBottom: "1rem",
};

const headingStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 600,
  color: "var(--app-body-text)",
  marginBottom: "1rem",
};

function vacio(): RecurringTicketFormData {
  return {
    title: "",
    description: "",
    priority: "MEDIA",
    category: null,
    checklist: [],
    clientId: null,
    planId: null,
    siteId: null,
    assignedToId: null,
    reviewerIds: [],
    // Mensual por defecto: los tickets que se programan son mantenimientos y
    // revisiones, no algo de todos los días.
    frequency: "MENSUAL",
    interval: 1,
    daysOfWeek: [],
    dayOfMonth: null,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: null,
    dueDateOffsetDays: 0,
    isActive: true,
  };
}

export function RecurringTicketForm({
  initial,
  clients,
  staffUsers,
  plans,
  sites,
}: {
  initial?: RecurringTicketFormData;
  clients: Option[];
  staffUsers: Option[];
  plans: PlanOption[];
  sites: SiteOption[];
}) {
  const router = useRouter();
  const [data, setData] = useState<RecurringTicketFormData>(initial ?? vacio());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function update<K extends keyof RecurringTicketFormData>(key: K, value: RecurringTicketFormData[K]) {
    setData((s) => ({ ...s, [key]: value }));
  }

  function toggleReviewer(id: string) {
    update(
      "reviewerIds",
      data.reviewerIds.includes(id)
        ? data.reviewerIds.filter((x) => x !== id)
        : [...data.reviewerIds, id],
    );
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("title", data.title);
    fd.set("description", data.description);
    fd.set("priority", data.priority);
    if (data.category) fd.set("category", data.category);
    fd.set("checklist", JSON.stringify(data.checklist));
    if (data.clientId) fd.set("clientId", data.clientId);
    if (data.planId) fd.set("planId", data.planId);
    if (data.siteId) fd.set("siteId", data.siteId);
    if (data.assignedToId) fd.set("assignedToId", data.assignedToId);
    for (const id of data.reviewerIds) fd.append("reviewerIds", id);

    fd.set("frequency", data.frequency);
    const interval = Number.isNaN(data.interval) || data.interval < 1 ? 1 : data.interval;
    fd.set("interval", String(interval));
    if (data.frequency === "SEMANAL") {
      for (const d of data.daysOfWeek) fd.append("daysOfWeek", String(d));
    }
    if (data.frequency === "MENSUAL" && data.dayOfMonth !== null) {
      fd.set("dayOfMonth", String(data.dayOfMonth));
    }
    fd.set("startDate", data.startDate);

    const offset =
      Number.isNaN(data.dueDateOffsetDays) || data.dueDateOffsetDays < 0 ? 0 : data.dueDateOffsetDays;
    fd.set("dueDateOffsetDays", String(offset));
    // Con plazo de vencimiento la fecha de fin no se manda: son dos formas de
    // decir hasta cuándo y juntas se contradicen. La pantalla ya la oculta.
    if (offset === 0 && data.endDate) fd.set("endDate", data.endDate);

    fd.set("isActive", data.isActive ? "true" : "false");
    return fd;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const fd = buildFormData();
      const r = initial?.id
        ? await updateRecurringTicket(initial.id, fd)
        : await createRecurringTicket(fd);

      // `create` redirige, así que solo se llega aquí si falló o si se editó.
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      setSuccess("Cambios guardados.");
      router.refresh();
    });
  }

  function handleRunNow() {
    if (!initial?.id) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const r = await runRecurringTicketNow(initial.id!);
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      setSuccess("Ticket generado. Aparece ya en la lista de tickets.");
      router.refresh();
    });
  }

  function handleDelete() {
    if (!initial?.id) return;
    startTransition(async () => {
      await deleteRecurringTicket(initial.id!);
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Qué ticket se abre */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>El ticket</h3>

        <div style={{ marginBottom: "0.875rem" }}>
          <label style={labelStyle}>Título</label>
          <input
            type="text"
            value={data.title}
            onChange={(e) => update("title", e.target.value)}
            required
            maxLength={200}
            placeholder="Mantenimiento mensual del sitio"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: "0.875rem" }}>
          <label style={labelStyle}>Descripción</label>
          <textarea
            value={data.description}
            onChange={(e) => update("description", e.target.value)}
            required
            rows={4}
            placeholder="Qué hay que hacer cada vez."
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label style={labelStyle}>Prioridad</label>
            <select
              value={data.priority}
              onChange={(e) => update("priority", e.target.value as RecurringTicketFormData["priority"])}
              style={inputStyle}
            >
              <option value="BAJA">Baja</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
              <option value="CRITICA">Crítica</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Categoría</label>
            <select
              value={data.category ?? ""}
              onChange={(e) => update("category", e.target.value || null)}
              style={inputStyle}
            >
              <option value="">Sin categoría</option>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* De quién es y quién lo atiende */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Cliente y responsables</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.875rem" }}>
          <div>
            <label style={labelStyle}>Cliente</label>
            <select
              value={data.clientId ?? ""}
              onChange={(e) => update("clientId", e.target.value || null)}
              style={inputStyle}
            >
              <option value="">Sin cliente (ticket interno)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Responsable</label>
            <select
              value={data.assignedToId ?? ""}
              onChange={(e) => update("assignedToId", e.target.value || null)}
              style={inputStyle}
            >
              <option value="">Sin asignar</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.875rem" }}>
          <div>
            <label style={labelStyle}>Plan</label>
            <select
              value={data.planId ?? ""}
              onChange={(e) => update("planId", e.target.value || null)}
              style={inputStyle}
            >
              <option value="">Sin plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.companyName} — {p.name}
                </option>
              ))}
            </select>
            {/* El plan decide el prefijo del código y contra qué bolsa se
                descuentan las horas: sin él, un mantenimiento mensual no
                consume nada y el cliente no lo ve en su paquete. */}
            <p style={{ fontSize: "0.6875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
              Sin plan, las horas no se descuentan de ningún paquete.
            </p>
          </div>
          <div>
            <label style={labelStyle}>Sitio</label>
            <select
              value={data.siteId ?? ""}
              onChange={(e) => update("siteId", e.target.value || null)}
              style={inputStyle}
            >
              <option value="">Sin sitio</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.companyName} — {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Revisores (opcional)</label>
          <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
            {staffUsers.map((u) => {
              const active = data.reviewerIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleReviewer(u.id)}
                  style={{
                    padding: "0.375rem 0.75rem",
                    borderRadius: "9999px",
                    border: `1px solid ${active ? "#fd1384" : "var(--app-border)"}`,
                    backgroundColor: active ? "rgba(253,19,132,0.15)" : "var(--app-content-bg)",
                    color: active ? "#fd1384" : "var(--app-body-text)",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {u.name}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: "0.6875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
            Si alguno deja de estar activo, se omite sin romper la programación.
          </p>
        </div>
      </div>

      {/* Checklist */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Checklist</h3>
        <DraftChecklist
          groups={data.checklist}
          onChange={(groups) => update("checklist", groups)}
        />
        <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.5rem" }}>
          Cada ticket generado incluirá estos ítems como checklist.
        </p>
      </div>

      {/* Cuándo se abre */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Patrón de repetición</h3>

        <div style={{ marginBottom: "0.875rem" }}>
          <label style={labelStyle}>Plazo para atenderlo (días)</label>
          <input
            type="number"
            min={0}
            max={365}
            value={Number.isNaN(data.dueDateOffsetDays) ? "" : data.dueDateOffsetDays}
            onChange={(e) => {
              const v = e.target.value;
              update("dueDateOffsetDays", v === "" ? NaN : parseInt(v, 10));
            }}
            onBlur={(e) => {
              const n = parseInt(e.target.value, 10);
              if (Number.isNaN(n) || n < 0) update("dueDateOffsetDays", 0);
            }}
            style={inputStyle}
          />
          <p style={{ fontSize: "0.6875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
            Días desde que se abre hasta su fecha límite. 0 = sin fecha límite.
          </p>
        </div>

        <RecurrenceFields
          value={data}
          onChange={(patch) => setData((s) => ({ ...s, ...patch }))}
          noun="tickets"
        />
      </div>

      {success && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            backgroundColor: "rgba(22,163,74,0.1)",
            border: "1px solid #16a34a",
            borderRadius: "0.5rem",
            color: "#16a34a",
            fontSize: "0.875rem",
          }}
        >
          <CheckCircle2 style={{ width: "1rem", height: "1rem", flexShrink: 0 }} />
          {success}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            backgroundColor: "rgba(220,38,38,0.1)",
            border: "1px solid #dc2626",
            borderRadius: "0.5rem",
            color: "#dc2626",
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: "0.5rem 1.25rem",
            backgroundColor: "#fd1384",
            color: "#fff",
            border: "none",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.5 : 1,
          }}
        >
          {initial?.id ? "Guardar cambios" : "Crear recurrencia"}
        </button>

        {initial?.id && (
          <>
            <button
              type="button"
              onClick={handleRunNow}
              disabled={isPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.5rem 1.25rem",
                backgroundColor: "transparent",
                color: "var(--app-body-text)",
                border: "1px solid var(--app-border)",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              <Play style={{ width: "0.85rem", height: "0.85rem" }} />
              Generar ahora
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.5rem 1.25rem",
                backgroundColor: "transparent",
                color: "#dc2626",
                border: "1px solid #dc2626",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: isPending ? "not-allowed" : "pointer",
                marginLeft: "auto",
              }}
            >
              <Trash2 style={{ width: "0.85rem", height: "0.85rem" }} />
              Eliminar
            </button>
          </>
        )}
      </div>
    </form>
  );
}
