"use client";

import { useState, useTransition } from "react";
import {
  Webhook, Plus, Trash2, Loader2, CheckCircle2, XCircle, Send,
  ChevronDown, ChevronUp,
} from "lucide-react";
import {
  createWebhook, updateWebhook, deleteWebhook, toggleWebhook, testWebhook,
  type UserWebhookItem,
} from "@/actions/user-webhook.actions";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-categories";

const ACCENT = "#fd1384";

const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: "0.8125rem",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.375rem",
  border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-content-bg)",
  color: "var(--app-body-text)",
  outline: "none",
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--app-text-muted)",
  marginBottom: "0.375rem",
};

const cardStyle: React.CSSProperties = {
  backgroundColor: "var(--app-card-bg)",
  border: "1px solid var(--app-border)",
  borderRadius: "0.75rem",
  padding: "1.25rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.875rem",
};

// ─── Selector de categorías ─────────────────────────────────────────────────

function CategoryPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {NOTIFICATION_CATEGORIES.map((cat) => {
        const active = selected.includes(cat.key);
        return (
          <button
            key={cat.key}
            type="button"
            onClick={() => toggle(cat.key)}
            title={cat.description}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.75rem",
              fontWeight: 500,
              padding: "0.3rem 0.7rem",
              borderRadius: "9999px",
              border: `1px solid ${active ? ACCENT : "var(--app-border)"}`,
              backgroundColor: active ? `${ACCENT}15` : "var(--app-content-bg)",
              color: active ? ACCENT : "var(--app-text-muted)",
              cursor: "pointer",
            }}
          >
            {active ? <CheckCircle2 style={{ width: "0.8rem", height: "0.8rem" }} /> : null}
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Tarjeta de webhook existente ───────────────────────────────────────────

function WebhookCard({ hook }: { hook: UserWebhookItem }) {
  const [label, setLabel] = useState(hook.label ?? "");
  const [url, setUrl] = useState(hook.url);
  const [events, setEvents] = useState<string[]>(hook.events);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function flash(kind: "ok" | "error", text: string) {
    setMsg({ kind, text });
    setTimeout(() => setMsg(null), 4000);
  }

  function save() {
    startTransition(async () => {
      const res = await updateWebhook(hook.id, { label, url, events, isActive: hook.isActive });
      if (res.error) flash("error", res.error);
      else flash("ok", "Cambios guardados.");
    });
  }

  function remove() {
    if (!confirm("¿Eliminar este webhook?")) return;
    startTransition(async () => {
      const res = await deleteWebhook(hook.id);
      if (res.error) flash("error", res.error);
    });
  }

  function toggleActive() {
    startTransition(async () => {
      await toggleWebhook(hook.id, !hook.isActive);
    });
  }

  function test() {
    startTransition(async () => {
      const res = await testWebhook(hook.id);
      if (res.ok) flash("ok", `Prueba enviada (HTTP ${res.status}).`);
      else flash("error", res.error ?? "Falló el envío de prueba.");
    });
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0 }}>
          <div style={{ width: "2rem", height: "2rem", borderRadius: "0.5rem", backgroundColor: `${ACCENT}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Webhook style={{ width: "1rem", height: "1rem", color: ACCENT }} />
          </div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {hook.label || "Webhook sin nombre"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleActive}
          disabled={isPending}
          title={hook.isActive ? "Desactivar" : "Activar"}
          style={{
            display: "flex", alignItems: "center", gap: "0.375rem",
            fontSize: "0.75rem", fontWeight: 500, padding: "0.25rem 0.625rem",
            borderRadius: "9999px", cursor: "pointer", flexShrink: 0,
            backgroundColor: hook.isActive ? "#dcfce7" : "var(--app-content-bg)",
            color: hook.isActive ? "#15803d" : "var(--app-text-muted)",
            border: `1px solid ${hook.isActive ? "#bbf7d0" : "var(--app-border)"}`,
          }}
        >
          {hook.isActive
            ? <><CheckCircle2 style={{ width: "0.75rem", height: "0.75rem" }} /> Activo</>
            : <><XCircle style={{ width: "0.75rem", height: "0.75rem" }} /> Inactivo</>}
        </button>
      </div>

      <div>
        <label style={labelStyle}>Nombre (opcional)</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: Mi Slack, Zapier..." style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>URL del webhook</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/..." style={{ ...inputStyle, fontFamily: "monospace" }} />
      </div>

      <div>
        <label style={labelStyle}>Notificaciones a enviar</label>
        <CategoryPicker selected={events} onChange={setEvents} />
      </div>

      {hook.secret && (
        <div>
          <label style={labelStyle}>Secreto de firma (HMAC SHA-256, cabecera X-Geniorama-Signature)</label>
          <input readOnly value={hook.secret} onFocus={(e) => e.currentTarget.select()} style={{ ...inputStyle, fontFamily: "monospace", color: "var(--app-text-muted)" }} />
        </div>
      )}

      {(hook.lastSentAt || hook.lastError) && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: hook.lastError ? "#b91c1c" : "var(--app-text-muted)" }}>
          {hook.lastError
            ? `Último envío falló: ${hook.lastError}`
            : `Último envío: HTTP ${hook.lastStatus ?? "?"}`}
        </p>
      )}

      {msg && (
        <p style={{ margin: 0, fontSize: "0.8125rem", color: msg.kind === "ok" ? "#15803d" : "#b91c1c", display: "flex", alignItems: "center", gap: "0.375rem" }}>
          {msg.kind === "ok" ? <CheckCircle2 style={{ width: "0.875rem", height: "0.875rem" }} /> : <XCircle style={{ width: "0.875rem", height: "0.875rem" }} />}
          {msg.text}
        </p>
      )}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" onClick={save} disabled={isPending}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", backgroundColor: ACCENT, color: "#fff", fontSize: "0.8125rem", fontWeight: 500, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>
          {isPending ? <Loader2 style={{ width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" }} /> : null}
          Guardar
        </button>
        <button type="button" onClick={test} disabled={isPending}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid var(--app-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-body-text)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" }}>
          <Send style={{ width: "0.875rem", height: "0.875rem" }} /> Probar
        </button>
        <button type="button" onClick={remove} disabled={isPending}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--app-border)", backgroundColor: "var(--app-card-bg)", color: "#b91c1c", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", marginLeft: "auto" }}>
          <Trash2 style={{ width: "0.875rem", height: "0.875rem" }} /> Eliminar
        </button>
      </div>
    </div>
  );
}

// ─── Formulario para agregar ────────────────────────────────────────────────

function NewWebhookForm() {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await createWebhook({ label, url, events });
      if (res.error) { setError(res.error); return; }
      setLabel(""); setUrl(""); setEvents([]); setOpen(false);
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", alignSelf: "flex-start", padding: "0.625rem 1rem", borderRadius: "0.5rem", border: `1px dashed ${ACCENT}`, backgroundColor: `${ACCENT}10`, color: ACCENT, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}>
        <Plus style={{ width: "1rem", height: "1rem" }} /> Agregar webhook
      </button>
    );
  }

  return (
    <div style={{ ...cardStyle, borderStyle: "dashed" }}>
      <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)" }}>Nuevo webhook</p>
      <div>
        <label style={labelStyle}>Nombre (opcional)</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: Mi Slack, Zapier..." style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>URL del webhook</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.zapier.com/..." style={{ ...inputStyle, fontFamily: "monospace" }} />
      </div>
      <div>
        <label style={labelStyle}>Notificaciones a enviar</label>
        <CategoryPicker selected={events} onChange={setEvents} />
      </div>
      {error && <p style={{ margin: 0, fontSize: "0.8125rem", color: "#b91c1c" }}>{error}</p>}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" onClick={submit} disabled={isPending}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", backgroundColor: ACCENT, color: "#fff", fontSize: "0.8125rem", fontWeight: 500, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}>
          {isPending ? <Loader2 style={{ width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" }} /> : null}
          Crear
        </button>
        <button type="button" onClick={() => { setOpen(false); setError(""); }} disabled={isPending}
          style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid var(--app-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-muted)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Documentación del payload ──────────────────────────────────────────────

function PayloadDocs() {
  const [open, setOpen] = useState(false);
  const example = `POST <tu-url>
Content-Type: application/json
X-Geniorama-Event: ticket_new
X-Geniorama-Signature: sha256=<hmac>

{
  "event": "ticket_new",
  "category": "tickets",
  "title": "Nuevo ticket #1024",
  "message": "Juan abrió un ticket en Acme",
  "url": "https://app.geniorama.co/tickets/abc123",
  "timestamp": "2026-06-03T15:04:05.000Z",
  "text": "🎫 Nuevo ticket #1024\\nJuan abrió un ticket en Acme\\nhttps://app.geniorama.co/tickets/abc123"
}`;

  return (
    <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", overflow: "hidden" }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)" }}>
          ¿Cómo es el mensaje que recibe tu app?
        </span>
        {open
          ? <ChevronUp style={{ width: "1rem", height: "1rem", color: "var(--app-text-muted)" }} />
          : <ChevronDown style={{ width: "1rem", height: "1rem", color: "var(--app-text-muted)" }} />}
      </button>
      {open && (
        <div style={{ padding: "0 1.25rem 1.25rem", borderTop: "1px solid var(--app-border)" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--app-body-text)", lineHeight: 1.5 }}>
            Cada notificación se envía como un <strong>POST</strong> con un cuerpo JSON. Funciona directo con
            Zapier, Make, n8n y servicios similares. El campo <code>text</code> ya viene formateado por si tu
            destino solo lee texto. Si configuras un secreto, puedes verificar la firma HMAC SHA-256 de la
            cabecera <code>X-Geniorama-Signature</code>.
          </p>
          <pre style={{ marginTop: "0.75rem", padding: "1rem", borderRadius: "0.5rem", backgroundColor: "var(--app-content-bg)", border: "1px solid var(--app-border)", fontSize: "0.75rem", color: "var(--app-body-text)", overflowX: "auto", fontFamily: "monospace", lineHeight: 1.5 }}>
            {example}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Root ───────────────────────────────────────────────────────────────────

export function UserWebhooks({ webhooks }: { webhooks: UserWebhookItem[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <PayloadDocs />
      {webhooks.map((hook) => (
        <WebhookCard key={hook.id} hook={hook} />
      ))}
      <NewWebhookForm />
    </div>
  );
}
