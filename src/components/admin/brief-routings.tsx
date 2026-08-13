"use client";

import { useState, useTransition } from "react";
import {
  Workflow, Plus, Trash2, Loader2, CheckCircle2, AlertTriangle,
  ChevronDown, ChevronUp, Copy, Check,
} from "lucide-react";
import {
  createBriefRouting, updateBriefRouting, deleteBriefRouting,
  type BriefRoutingInput,
} from "@/actions/brief-routing.actions";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type StaffOption = { id: string; name: string; email: string };

export type RoutingRow = {
  id: string;
  briefType: string;
  label: string;
  assignedToId: string;
  priority: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
  category: string | null;
  estimatedHours: number | null;
  dueDays: number | null;
  dueTime: string | null;
  isActive: boolean;
  assignedTo: { id: string; name: string; email: string; isActive: boolean };
};

const PRIORITIES = ["BAJA", "MEDIA", "ALTA", "CRITICA"] as const;
const ACCENT = "#8b5cf6";

// ─── Estilos compartidos ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  fontSize: "0.8125rem",
  padding: "0.5rem 0.625rem",
  borderRadius: "0.375rem",
  border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-content-bg)",
  color: "var(--app-body-text)",
  outline: "none",
  minWidth: 0,
  width: "100%",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.6875rem",
  fontWeight: 600,
  color: "var(--app-text-muted)",
  marginBottom: "0.25rem",
  textTransform: "uppercase",
  letterSpacing: "0.02em",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </div>
  );
}

// ─── Formulario de una regla (sirve para crear y para editar) ─────────────────

function RoutingForm({
  staff,
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  staff: StaffOption[];
  initial?: RoutingRow;
  onSubmit: (input: BriefRoutingInput) => Promise<{ error?: string }>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [briefType, setBriefType] = useState(initial?.briefType ?? "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [assignedToId, setAssignedToId] = useState(initial?.assignedToId ?? staff[0]?.id ?? "");
  const [priority, setPriority] = useState<RoutingRow["priority"]>(initial?.priority ?? "MEDIA");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [hours, setHours] = useState(initial?.estimatedHours?.toString() ?? "");
  const [dueDays, setDueDays] = useState(initial?.dueDays?.toString() ?? "");
  const [dueTime, setDueTime] = useState(initial?.dueTime ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError("");
    setSaved(false);
    startTransition(async () => {
      const res = await onSubmit({
        briefType,
        label,
        assignedToId,
        priority,
        category: category.trim() || undefined,
        estimatedHours: hours.trim() ? Number(hours) : undefined,
        dueDays: dueDays.trim() ? Number(dueDays) : undefined,
        dueTime: dueTime.trim() || undefined,
        isActive,
      });
      if (res.error) { setError(res.error); return; }
      setSaved(true);
      if (!initial) {
        setBriefType(""); setLabel(""); setCategory(""); setHours("");
        setDueDays(""); setDueTime("");
      }
      onCancel?.();
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))",
          gap: "0.75rem",
        }}
      >
        <Field label="Tipo de brief (n8n)">
          <input
            value={briefType}
            onChange={(e) => setBriefType(e.target.value)}
            placeholder="sitio-web"
            style={{ ...inputStyle, fontFamily: "monospace" }}
          />
        </Field>
        <Field label="Nombre visible">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Brief de sitio web"
            style={inputStyle}
          />
        </Field>
        <Field label="Responsable">
          <select
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
            style={inputStyle}
          >
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Prioridad">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as RoutingRow["priority"])}
            style={inputStyle}
          >
            {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Categoría">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Opcional"
            style={inputStyle}
          />
        </Field>
        <Field label="Horas estimadas">
          <input
            type="number"
            min="0"
            step="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="Opcional"
            style={inputStyle}
          />
        </Field>
        <Field label="Plazo (días hábiles)">
          <input
            type="number"
            min="0"
            step="1"
            value={dueDays}
            onChange={(e) => setDueDays(e.target.value)}
            placeholder="Sin plazo"
            style={inputStyle}
          />
        </Field>
        <Field label="Hora límite">
          <input
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--app-text-muted)", lineHeight: 1.5 }}>
        El plazo cuenta <strong>días hábiles</strong> desde que entra el brief, saltando sábados y domingos
        (no contempla festivos). Sin plazo, la tarea nace sin fecha límite salvo que n8n mande una.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", color: "var(--app-body-text)", cursor: "pointer" }}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Regla activa
        </label>

        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              style={{
                padding: "0.5rem 0.875rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--app-border)",
                backgroundColor: "var(--app-card-bg)",
                color: "var(--app-text-muted)",
                fontSize: "0.8125rem",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "none",
              backgroundColor: ACCENT,
              color: "#fff",
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: isPending ? "not-allowed" : "pointer",
              opacity: isPending ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              whiteSpace: "nowrap",
            }}
          >
            {isPending
              ? <><Loader2 style={{ width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" }} /> Guardando...</>
              : submitLabel}
          </button>
        </div>
      </div>

      {error && <p style={{ margin: 0, fontSize: "0.8125rem", color: "#b91c1c" }}>{error}</p>}
      {saved && !error && (
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "#15803d", display: "flex", alignItems: "center", gap: "0.375rem" }}>
          <CheckCircle2 style={{ width: "0.875rem", height: "0.875rem" }} /> Regla guardada.
        </p>
      )}
    </div>
  );
}

// ─── Fila de la tabla ─────────────────────────────────────────────────────────

function RoutingCard({ routing, staff }: { routing: RoutingRow; staff: StaffOption[] }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleDelete() {
    if (!confirm(`¿Eliminar la regla "${routing.label}"? Los briefs de tipo "${routing.briefType}" dejarán de crear tareas.`)) return;
    setError("");
    startTransition(async () => {
      const res = await deleteBriefRouting(routing.id);
      if (res.error) setError(res.error);
    });
  }

  const assigneeInactive = !routing.assignedTo.isActive;

  return (
    <div
      style={{
        border: "1px solid var(--app-border)",
        borderRadius: "0.625rem",
        backgroundColor: "var(--app-content-bg)",
        padding: "0.875rem 1rem",
        opacity: routing.isActive ? 1 : 0.6,
      }}
    >
      {editing ? (
        <RoutingForm
          staff={staff}
          initial={routing}
          submitLabel="Guardar cambios"
          onCancel={() => setEditing(false)}
          onSubmit={(input) => updateBriefRouting(routing.id, input)}
        />
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <code
            style={{
              fontSize: "0.75rem",
              padding: "0.2rem 0.5rem",
              borderRadius: "0.25rem",
              backgroundColor: `${ACCENT}18`,
              color: ACCENT,
              fontWeight: 600,
            }}
          >
            {routing.briefType}
          </code>

          <div style={{ flex: 1, minWidth: "10rem" }}>
            <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)" }}>
              {routing.label}
            </p>
            <p style={{ margin: "0.125rem 0 0", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
              → {routing.assignedTo.name}
              {" · "}{routing.priority}
              {routing.category ? ` · ${routing.category}` : ""}
              {routing.estimatedHours ? ` · ${routing.estimatedHours} h` : ""}
              {routing.dueDays !== null
                ? ` · vence en ${routing.dueDays} ${routing.dueDays === 1 ? "día hábil" : "días hábiles"}${routing.dueTime ? ` a las ${routing.dueTime}` : ""}`
                : " · sin plazo"}
              {!routing.isActive && " · inactiva"}
            </p>
          </div>

          {assigneeInactive && (
            <span
              title="El responsable está inactivo: los briefs de este tipo llegarán sin asignar."
              style={{
                display: "flex", alignItems: "center", gap: "0.25rem",
                fontSize: "0.6875rem", color: "#b45309", backgroundColor: "#fef3c7",
                border: "1px solid #fde68a", padding: "0.2rem 0.5rem", borderRadius: "9999px",
              }}
            >
              <AlertTriangle style={{ width: "0.75rem", height: "0.75rem" }} /> Responsable inactivo
            </span>
          )}

          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{
              padding: "0.375rem 0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--app-border)",
              backgroundColor: "var(--app-card-bg)",
              color: "var(--app-body-text)",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            Editar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            title="Eliminar regla"
            style={{
              padding: "0.375rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--app-border)",
              backgroundColor: "var(--app-card-bg)",
              color: "#b91c1c",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            {isPending
              ? <Loader2 style={{ width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" }} />
              : <Trash2 style={{ width: "0.875rem", height: "0.875rem" }} />}
          </button>

          {error && <p style={{ margin: 0, width: "100%", fontSize: "0.8125rem", color: "#b91c1c" }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Instrucciones para n8n ───────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      style={{
        padding: "0.25rem 0.5rem",
        borderRadius: "0.25rem",
        border: "1px solid var(--app-border)",
        backgroundColor: "var(--app-card-bg)",
        color: "var(--app-text-muted)",
        fontSize: "0.6875rem",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        flexShrink: 0,
      }}
    >
      {copied
        ? <><Check style={{ width: "0.75rem", height: "0.75rem" }} /> Copiado</>
        : <><Copy style={{ width: "0.75rem", height: "0.75rem" }} /> Copiar</>}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div style={{ position: "relative" }}>
      <pre
        style={{
          margin: 0,
          padding: "0.75rem",
          borderRadius: "0.5rem",
          backgroundColor: "var(--app-content-bg)",
          border: "1px solid var(--app-border)",
          fontSize: "0.75rem",
          color: "var(--app-body-text)",
          overflowX: "auto",
          lineHeight: 1.5,
        }}
      >
        {code}
      </pre>
      <div style={{ position: "absolute", top: "0.5rem", right: "0.5rem" }}>
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function N8nInstructions({
  webhookUrl,
  tokenConfigured,
  briefTypes,
}: {
  webhookUrl: string;
  tokenConfigured: boolean;
  briefTypes: string[];
}) {
  const [open, setOpen] = useState(false);

  const samplePayload = JSON.stringify(
    {
      projectId: "cl-id-del-proyecto",
      briefType: briefTypes[0] ?? "sitio-web",
      externalRef: "{{ $execution.id }}",
      title: "Brief de sitio web — Acme S.A.S.",
      summary: "Resumen corto opcional del brief.",
      client: {
        name: "Ana Pérez",
        email: "ana@acme.com",
        phone: "+57 300 000 0000",
        company: "Acme S.A.S.",
      },
      fields: {
        "Presupuesto": "$ 12.000.000",
        "Fecha deseada de lanzamiento": "2026-10-01",
        "Referencias": ["https://ejemplo.com", "https://otro.com"],
      },
      links: [{ url: "https://drive.google.com/...", label: "Logos y manual de marca" }],
      dueDate: "2026-09-15",
      submittedAt: "{{ $now }}",
    },
    null,
    2,
  );

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.25rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <Workflow style={{ width: "1rem", height: "1rem", color: ACCENT }} />
          <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)" }}>
            ¿Cómo conectar el workflow de n8n?
          </span>
        </div>
        {open
          ? <ChevronUp style={{ width: "1rem", height: "1rem", color: "var(--app-text-muted)", flexShrink: 0 }} />
          : <ChevronDown style={{ width: "1rem", height: "1rem", color: "var(--app-text-muted)", flexShrink: 0 }} />}
      </button>

      {open && (
        <div style={{ padding: "1rem 1.25rem 1.25rem", borderTop: "1px solid var(--app-border)", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <p style={{ margin: "0 0 0.375rem", fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-body-text)" }}>
              1. Añade un nodo <em>HTTP Request</em> al final del workflow, con método POST a esta URL:
            </p>
            <CodeBlock code={webhookUrl} />
          </div>

          <div>
            <p style={{ margin: "0 0 0.375rem", fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-body-text)" }}>
              2. Autenticación por cabecera:
            </p>
            <CodeBlock code={"Authorization: Bearer <INTEGRATION_BRIEF_TOKEN>"} />
            {!tokenConfigured && (
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", color: "#b45309", display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <AlertTriangle style={{ width: "0.875rem", height: "0.875rem" }} />
                Falta definir <code>INTEGRATION_BRIEF_TOKEN</code> en el servidor: mientras no exista, el endpoint responde 401 a todo.
              </p>
            )}
          </div>

          <div>
            <p style={{ margin: "0 0 0.375rem", fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-body-text)" }}>
              3. Cuerpo del request (JSON). Solo <code>projectId</code> y <code>briefType</code> son obligatorios:
            </p>
            <CodeBlock code={samplePayload} />
          </div>

          <div
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              backgroundColor: "#eff6ff",
              border: "1px solid #bfdbfe",
              fontSize: "0.8125rem",
              color: "#1e40af",
              lineHeight: 1.5,
            }}
          >
            <strong>Ten en cuenta:</strong>
            <ul style={{ margin: "0.375rem 0 0", paddingLeft: "1.125rem" }}>
              <li>El responsable no se manda desde n8n: sale del <code>briefType</code> según las reglas de arriba.</li>
              <li>Manda <code>externalRef</code> con el id de ejecución: si n8n reintenta, no se duplica la tarea.</li>
              <li>Si el <code>briefType</code> no tiene regla activa, la respuesta es 422 y lista los tipos válidos.</li>
              <li>Todo lo que pongas en <code>fields</code> se vuelca en la descripción de la tarea.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function BriefRoutings({
  routings,
  staff,
  webhookUrl,
  tokenConfigured,
}: {
  routings: RoutingRow[];
  staff: StaffOption[];
  webhookUrl: string;
  tokenConfigured: boolean;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <N8nInstructions
        webhookUrl={webhookUrl}
        tokenConfigured={tokenConfigured}
        briefTypes={routings.map((r) => r.briefType)}
      />

      <div
        style={{
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            padding: "1rem 1.25rem",
            borderBottom: "1px solid var(--app-border)",
          }}
        >
          <div
            style={{
              width: "2rem", height: "2rem", borderRadius: "0.5rem",
              backgroundColor: `${ACCENT}20`, display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}
          >
            <Workflow style={{ width: "1rem", height: "1rem", color: ACCENT }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)" }}>
              Briefs desde n8n
            </p>
            <p style={{ margin: "0.125rem 0 0", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
              Cada tipo de brief que diligencia el cliente cae en un responsable distinto.
            </p>
          </div>
          {!adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={staff.length === 0}
              style={{
                padding: "0.5rem 0.875rem",
                borderRadius: "0.375rem",
                border: "none",
                backgroundColor: ACCENT,
                color: "#fff",
                fontSize: "0.8125rem",
                fontWeight: 500,
                cursor: staff.length === 0 ? "not-allowed" : "pointer",
                opacity: staff.length === 0 ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                gap: "0.375rem",
                whiteSpace: "nowrap",
              }}
            >
              <Plus style={{ width: "0.875rem", height: "0.875rem" }} /> Nueva regla
            </button>
          )}
        </div>

        <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {adding && (
            <div
              style={{
                border: `1px dashed ${ACCENT}`,
                borderRadius: "0.625rem",
                padding: "0.875rem 1rem",
                backgroundColor: "var(--app-content-bg)",
              }}
            >
              <RoutingForm
                staff={staff}
                submitLabel="Crear regla"
                onCancel={() => setAdding(false)}
                onSubmit={createBriefRouting}
              />
            </div>
          )}

          {routings.length === 0 && !adding && (
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>
              Todavía no hay reglas. Mientras no exista una, los briefs que llegan de n8n se rechazan con un 422.
            </p>
          )}

          {routings.map((r) => (
            <RoutingCard key={r.id} routing={r} staff={staff} />
          ))}
        </div>
      </div>
    </div>
  );
}
