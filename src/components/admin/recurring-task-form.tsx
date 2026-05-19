"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createRecurringTemplate,
  updateRecurringTemplate,
  deleteRecurringTemplate,
  runRecurringNow,
} from "@/actions/recurring-task.actions";

type Project = { id: string; name: string };
type StaffUser = { id: string; name: string };

export type RecurringFormData = {
  id?: string;
  title: string;
  description: string;
  priority: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  category: string | null;
  estimatedHours: number | null;
  projectId: string | null;
  assignedToId: string | null;
  frequency: "DIARIA" | "SEMANAL" | "MENSUAL";
  interval: number;
  daysOfWeek: number[];
  dayOfMonth: number | null;
  startDate: string;
  endDate: string | null;
  dueDateOffsetDays: number;
  isActive: boolean;
};

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.5rem 0.75rem",
  fontSize: "0.875rem",
  border: "1px solid var(--app-border)",
  borderRadius: "0.5rem",
  backgroundColor: "var(--app-content-bg)",
  color: "var(--app-body-text)",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--app-text-muted)",
  marginBottom: "0.375rem",
};

const sectionStyle: React.CSSProperties = {
  border: "1px solid var(--app-border)",
  borderRadius: "0.75rem",
  padding: "1.25rem",
  marginBottom: "1rem",
  backgroundColor: "var(--app-card-bg)",
};

export function RecurringTaskForm({
  initial,
  projects,
  staffUsers,
}: {
  initial?: RecurringFormData;
  projects: Project[];
  staffUsers: StaffUser[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<RecurringFormData>(
    initial ?? {
      title: "",
      description: "",
      priority: "MEDIA",
      category: null,
      estimatedHours: null,
      projectId: null,
      assignedToId: null,
      frequency: "DIARIA",
      interval: 1,
      daysOfWeek: [],
      dayOfMonth: null,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: null,
      dueDateOffsetDays: 0,
      isActive: true,
    }
  );

  function update<K extends keyof RecurringFormData>(key: K, value: RecurringFormData[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  function toggleDay(d: number) {
    setData((s) => ({
      ...s,
      daysOfWeek: s.daysOfWeek.includes(d) ? s.daysOfWeek.filter((x) => x !== d) : [...s.daysOfWeek, d],
    }));
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("title", data.title);
    fd.set("description", data.description);
    fd.set("priority", data.priority);
    if (data.category) fd.set("category", data.category);
    if (data.estimatedHours !== null) fd.set("estimatedHours", String(data.estimatedHours));
    if (data.projectId) fd.set("projectId", data.projectId);
    if (data.assignedToId) fd.set("assignedToId", data.assignedToId);
    fd.set("frequency", data.frequency);
    const interval = Number.isNaN(data.interval) || data.interval < 1 ? 1 : data.interval;
    fd.set("interval", String(interval));
    for (const d of data.daysOfWeek) fd.append("daysOfWeek", String(d));
    if (data.dayOfMonth !== null) fd.set("dayOfMonth", String(data.dayOfMonth));
    fd.set("startDate", data.startDate);
    const offset = Number.isNaN(data.dueDateOffsetDays) || data.dueDateOffsetDays < 0 ? 0 : data.dueDateOffsetDays;
    fd.set("dueDateOffsetDays", String(offset));
    if (data.endDate && offset === 0) fd.set("endDate", data.endDate);
    fd.set("isActive", data.isActive ? "true" : "false");
    return fd;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const fd = buildFormData();
      const result = initial?.id
        ? await updateRecurringTemplate(initial.id, fd)
        : await createRecurringTemplate(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  function handleDelete() {
    if (!initial?.id) return;
    if (!confirm("¿Eliminar esta plantilla? Las tareas ya generadas no se eliminarán.")) return;
    startTransition(async () => {
      await deleteRecurringTemplate(initial.id!);
    });
  }

  function handleRunNow() {
    if (!initial?.id) return;
    if (!confirm("¿Generar una tarea ahora desde esta plantilla?")) return;
    startTransition(async () => {
      const result = await runRecurringNow(initial.id!);
      if (result && "error" in result && result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: "48rem" }}>
      {/* Datos básicos */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "1rem" }}>
          Información de la tarea
        </h3>

        <div style={{ marginBottom: "0.875rem" }}>
          <label style={labelStyle}>Título</label>
          <input
            type="text"
            value={data.title}
            onChange={(e) => update("title", e.target.value)}
            required
            maxLength={200}
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
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.875rem" }}>
          <div>
            <label style={labelStyle}>Prioridad</label>
            <select value={data.priority} onChange={(e) => update("priority", e.target.value as RecurringFormData["priority"])} style={inputStyle}>
              <option value="BAJA">Baja</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
              <option value="CRITICA">Crítica</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Categoría (opcional)</label>
            <input
              type="text"
              value={data.category ?? ""}
              onChange={(e) => update("category", e.target.value || null)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label style={labelStyle}>Proyecto (opcional — vacío = global)</label>
            <select value={data.projectId ?? ""} onChange={(e) => update("projectId", e.target.value || null)} style={inputStyle}>
              <option value="">— Sin proyecto (global) —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Asignar a (opcional)</label>
            <select value={data.assignedToId ?? ""} onChange={(e) => update("assignedToId", e.target.value || null)} style={inputStyle}>
              <option value="">— Sin asignar —</option>
              {staffUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginTop: "0.875rem" }}>
          <div>
            <label style={labelStyle}>Horas estimadas (opcional)</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={data.estimatedHours ?? ""}
              onChange={(e) => update("estimatedHours", e.target.value === "" ? null : Number(e.target.value))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Vencimiento (días desde creación)</label>
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
                if (e.target.value === "" || Number.isNaN(parseInt(e.target.value, 10))) {
                  update("dueDateOffsetDays", 0);
                }
              }}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* Recurrencia */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "1rem" }}>
          Patrón de repetición
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.875rem" }}>
          <div>
            <label style={labelStyle}>Frecuencia</label>
            <select value={data.frequency} onChange={(e) => update("frequency", e.target.value as RecurringFormData["frequency"])} style={inputStyle}>
              <option value="DIARIA">Días</option>
              <option value="SEMANAL">Semanas</option>
              <option value="MENSUAL">Meses</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Cada</label>
            <input
              type="number"
              min={1}
              max={365}
              value={Number.isNaN(data.interval) ? "" : data.interval}
              onChange={(e) => {
                const v = e.target.value;
                update("interval", v === "" ? NaN : parseInt(v, 10));
              }}
              onBlur={(e) => {
                const n = parseInt(e.target.value, 10);
                if (Number.isNaN(n) || n < 1) update("interval", 1);
              }}
              style={inputStyle}
            />
          </div>
        </div>

        {data.frequency === "SEMANAL" && (
          <div style={{ marginBottom: "0.875rem" }}>
            <label style={labelStyle}>Días de la semana (opcional)</label>
            <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
              {DAY_LABELS.map((lbl, i) => {
                const active = data.daysOfWeek.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
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
                    {lbl}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: "0.6875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
              Si no seleccionas días, se generará el mismo día de la semana del inicio.
            </p>
          </div>
        )}

        {data.frequency === "MENSUAL" && (
          <div style={{ marginBottom: "0.875rem" }}>
            <label style={labelStyle}>Día del mes</label>
            <select
              value={data.dayOfMonth === null ? "" : String(data.dayOfMonth)}
              onChange={(e) => update("dayOfMonth", e.target.value === "" ? null : parseInt(e.target.value, 10))}
              style={inputStyle}
            >
              <option value="">Mismo día del inicio</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>Día {d}</option>
              ))}
              <option value="-1">Último día del mes</option>
            </select>
          </div>
        )}

        {(() => {
          const hasOffset = typeof data.dueDateOffsetDays === "number" && !Number.isNaN(data.dueDateOffsetDays) && data.dueDateOffsetDays > 0;
          return (
            <div style={{ display: "grid", gridTemplateColumns: hasOffset ? "1fr" : "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <label style={labelStyle}>Fecha de inicio</label>
                <input
                  type="date"
                  value={data.startDate}
                  onChange={(e) => update("startDate", e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
              {!hasOffset && (
                <div>
                  <label style={labelStyle}>Fecha de fin (opcional)</label>
                  <input
                    type="date"
                    value={data.endDate ?? ""}
                    onChange={(e) => update("endDate", e.target.value || null)}
                    style={inputStyle}
                  />
                </div>
              )}
            </div>
          );
        })()}

        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.875rem", fontSize: "0.875rem", color: "var(--app-body-text)", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={data.isActive}
            onChange={(e) => update("isActive", e.target.checked)}
          />
          Plantilla activa (genera tareas automáticamente)
        </label>
      </div>

      {error && (
        <div style={{ padding: "0.75rem 1rem", marginBottom: "1rem", backgroundColor: "rgba(220,38,38,0.1)", border: "1px solid #dc2626", borderRadius: "0.5rem", color: "#dc2626", fontSize: "0.875rem" }}>
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
          {initial?.id ? "Guardar cambios" : "Crear plantilla"}
        </button>

        {initial?.id && (
          <>
            <button
              type="button"
              onClick={handleRunNow}
              disabled={isPending}
              style={{
                padding: "0.5rem 1.25rem",
                backgroundColor: "transparent",
                color: "var(--app-body-text)",
                border: "1px solid var(--app-border)",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              Generar tarea ahora
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              style={{
                padding: "0.5rem 1.25rem",
                backgroundColor: "transparent",
                color: "var(--dropdown-danger-text)",
                border: "1px solid var(--dropdown-danger-text)",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: isPending ? "not-allowed" : "pointer",
                marginLeft: "auto",
              }}
            >
              Eliminar plantilla
            </button>
          </>
        )}
      </div>
    </form>
  );
}
