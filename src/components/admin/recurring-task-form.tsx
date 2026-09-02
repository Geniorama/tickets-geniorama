"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { DraftChecklist } from "@/components/ui/draft-checklist";
import type { ChecklistGroup } from "@/lib/checklist";
import {
  createRecurringTemplate,
  updateRecurringTemplate,
  deleteRecurringTemplate,
  runRecurringNow,
} from "@/actions/recurring-task.actions";
import { RecurrenceFields } from "@/components/ui/recurrence-fields";
import { TASK_CATEGORY_GROUPS, TASK_CATEGORIES } from "@/lib/task-categories";
import { splitEstimatedHours, combineEstimatedTime } from "@/lib/estimated-time";

type Project = { id: string; name: string };
type StaffUser = { id: string; name: string };

export type TaskTemplateOption = {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  category: string | null;
  estimatedHours: number | null;
  checklist: ChecklistGroup[];
};

export type RecurringFormData = {
  id?: string;
  title: string;
  description: string;
  priority: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  category: string | null;
  estimatedHours: number | null;
  checklist: ChecklistGroup[];
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
  taskTemplates = [],
  justCreated = false,
}: {
  initial?: RecurringFormData;
  projects: Project[];
  staffUsers: StaffUser[];
  taskTemplates?: TaskTemplateOption[];
  justCreated?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(
    justCreated ? "Plantilla recurrente creada correctamente." : null
  );

  // Auto-oculta el aviso de éxito tras unos segundos.
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(null), 5000);
    return () => clearTimeout(t);
  }, [success]);

  const [data, setData] = useState<RecurringFormData>(
    initial ?? {
      title: "",
      description: "",
      priority: "MEDIA",
      category: null,
      estimatedHours: null,
      checklist: [],
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

  function applyTemplate(templateId: string) {
    const tpl = taskTemplates.find((t) => t.id === templateId);
    if (!tpl) return;
    setData((d) => ({
      ...d,
      title: tpl.title,
      description: tpl.description,
      priority: tpl.priority,
      category: tpl.category,
      estimatedHours: tpl.estimatedHours,
      checklist: tpl.checklist.map((g) => ({ title: g.title, items: [...g.items] })),
    }));
  }

  function buildFormData(): FormData {
    const fd = new FormData();
    fd.set("title", data.title);
    fd.set("description", data.description);
    fd.set("priority", data.priority);
    if (data.category) fd.set("category", data.category);
    if (data.estimatedHours !== null) fd.set("estimatedHours", String(data.estimatedHours));
    fd.set("checklist", JSON.stringify(data.checklist));
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
    setSuccess(null);
    startTransition(async () => {
      const fd = buildFormData();
      // En creación el action redirige (lanza), así que el éxito se muestra al
      // aterrizar en la página de edición vía ?created=1.
      const result = initial?.id
        ? await updateRecurringTemplate(initial.id, fd)
        : await createRecurringTemplate(fd);
      if (result && "error" in result && result.error) {
        setError(result.error);
      } else {
        setSuccess("Cambios guardados correctamente.");
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
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await runRecurringNow(initial.id!);
      if (result && "error" in result && result.error) setError(result.error);
      else {
        setSuccess("Tarea generada correctamente.");
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: "48rem" }}>
      {/* Datos básicos */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "1rem" }}>
          Información de la tarea
        </h3>

        {taskTemplates.length > 0 && (
          <div style={{ marginBottom: "0.875rem" }}>
            <label style={labelStyle}>Usar plantilla de tarea (opcional)</label>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) applyTemplate(e.target.value);
                e.target.value = "";
              }}
              style={inputStyle}
            >
              <option value="">— Prellenar desde una plantilla —</option>
              {taskTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p style={{ fontSize: "0.6875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
              Copia título, descripción, prioridad, categoría, horas y checklist. Luego puedes ajustar los campos.
            </p>
          </div>
        )}

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
            <select
              value={data.category ?? ""}
              onChange={(e) => update("category", e.target.value || null)}
              style={inputStyle}
            >
              <option value="">— Sin categoría —</option>
              {data.category && !TASK_CATEGORIES.includes(data.category) && (
                <option value={data.category}>{data.category}</option>
              )}
              {TASK_CATEGORY_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
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
            <label style={labelStyle}>Tiempo estimado (opcional)</label>
            <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
              <input
                type="number"
                min={0}
                step={1}
                aria-label="Horas estimadas"
                value={splitEstimatedHours(data.estimatedHours).hours ?? ""}
                onChange={(e) =>
                  update("estimatedHours", combineEstimatedTime(e.target.value, splitEstimatedHours(data.estimatedHours).minutes))
                }
                style={{ ...inputStyle, textAlign: "right" }}
              />
              <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>h</span>
              <input
                type="number"
                min={0}
                max={59}
                step={1}
                aria-label="Minutos estimados"
                value={splitEstimatedHours(data.estimatedHours).minutes ?? ""}
                onChange={(e) =>
                  update("estimatedHours", combineEstimatedTime(splitEstimatedHours(data.estimatedHours).hours, e.target.value))
                }
                style={{ ...inputStyle, textAlign: "right" }}
              />
              <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>m</span>
            </div>
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

        {/* Checklist */}
        <div style={{ marginTop: "0.875rem" }}>
          <label style={labelStyle}>
            Checklist (opcional)
          </label>
          <DraftChecklist
            groups={data.checklist}
            onChange={(groups) => update("checklist", groups)}
            placeholder="Agregar ítem y pulsar Enter"
          />
          <p style={{ fontSize: "0.6875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
            Cada tarea generada incluirá estos ítems como checklist.
          </p>
        </div>
      </div>

      {/* Recurrencia */}
      <div style={sectionStyle}>
        <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "1rem" }}>
          Patrón de repetición
        </h3>

        <RecurrenceFields
          value={data}
          onChange={(patch) => setData((s) => ({ ...s, ...patch }))}
          noun="tareas"
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
