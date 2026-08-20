"use client";

/**
 * Pantalla de hooks, la misma para los de organización y los de un proyecto.
 *
 * Un solo componente porque la diferencia entre ambos alcances es qué eventos se
 * ofrecen y a quién se le permite tocarlos —cosas que ya decide el servidor—, no
 * cómo se administran.
 */

import { useState, useTransition } from "react";
import {
  Webhook, Plus, Trash2, Loader2, CheckCircle2, XCircle, Send,
  ChevronDown, ChevronUp, History,
} from "lucide-react";
import {
  createHook, updateHook, deleteHook, toggleHook, testHook, getHookDeliveries,
  type HookItem, type HookDeliveryItem,
} from "@/actions/hook.actions";
import {
  HOOK_EVENTS,
  RESOURCE_LABELS,
  allowedEventsFor,
  type HookEventDefinition,
  type HookResource,
} from "@/lib/hooks/events";

const ACCENT = "#6366f1";

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

const primaryButton = (disabled: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  padding: "0.5rem 1rem",
  borderRadius: "0.375rem",
  border: "none",
  backgroundColor: ACCENT,
  color: "#fff",
  fontSize: "0.8125rem",
  fontWeight: 500,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.7 : 1,
});

const secondaryButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  padding: "0.5rem 1rem",
  borderRadius: "0.375rem",
  border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-card-bg)",
  color: "var(--app-body-text)",
  fontSize: "0.8125rem",
  fontWeight: 500,
  cursor: "pointer",
};

// ─── Selector de eventos ────────────────────────────────────────────────────

function EventPicker({
  scope,
  selected,
  onChange,
}: {
  scope: "ORG" | "PROJECT";
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const allowed = new Set(allowedEventsFor(scope));
  const byResource = new Map<HookResource, HookEventDefinition[]>();
  for (const event of HOOK_EVENTS) {
    if (!allowed.has(event.key)) continue;
    const list = byResource.get(event.resource) ?? [];
    byResource.set(event.resource, [...list, event]);
  }

  function toggle(key: string) {
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  function toggleGroup(keys: string[]) {
    const allOn = keys.every((k) => selected.includes(k));
    onChange(allOn ? selected.filter((k) => !keys.includes(k)) : [...new Set([...selected, ...keys])]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {[...byResource.entries()].map(([resource, events]) => {
        const keys = events.map((e) => e.key);
        const allOn = keys.every((k) => selected.includes(k));
        return (
          <div key={resource}>
            <button
              type="button"
              onClick={() => toggleGroup(keys)}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                marginBottom: "0.375rem",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: allOn ? ACCENT : "var(--app-text-muted)",
                cursor: "pointer",
              }}
            >
              {RESOURCE_LABELS[resource]} · {allOn ? "quitar todos" : "todos"}
            </button>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {events.map((event) => {
                const active = selected.includes(event.key);
                return (
                  <button
                    key={event.key}
                    type="button"
                    onClick={() => toggle(event.key)}
                    title={event.description}
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
                    <code style={{ fontFamily: "monospace" }}>{event.key}</code>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Historial de entregas ──────────────────────────────────────────────────

function Deliveries({ hookId }: { hookId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<HookDeliveryItem[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && rows === null) {
      startTransition(async () => setRows(await getHookDeliveries(hookId)));
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          background: "none",
          border: "none",
          padding: 0,
          fontSize: "0.75rem",
          color: "var(--app-text-muted)",
          cursor: "pointer",
        }}
      >
        <History style={{ width: "0.8rem", height: "0.8rem" }} />
        Últimas entregas
        {open
          ? <ChevronUp style={{ width: "0.8rem", height: "0.8rem" }} />
          : <ChevronDown style={{ width: "0.8rem", height: "0.8rem" }} />}
      </button>

      {open && (
        <div style={{ marginTop: "0.5rem" }}>
          {isPending && <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--app-text-muted)" }}>Cargando…</p>}
          {!isPending && rows?.length === 0 && (
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
              Todavía no se ha enviado nada por este hook.
            </p>
          )}
          {!isPending && rows && rows.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              {rows.map((row) => {
                const ok = row.status !== null && row.status < 400;
                return (
                  <div
                    key={row.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      fontSize: "0.7rem",
                      fontFamily: "monospace",
                      color: "var(--app-text-muted)",
                    }}
                  >
                    <span style={{ color: ok ? "#15803d" : "#b91c1c", fontWeight: 600, minWidth: "2.5rem" }}>
                      {row.status ?? "×"}
                    </span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.event}
                      {row.error ? ` — ${row.error}` : ""}
                    </span>
                    <span>{row.durationMs !== null ? `${row.durationMs} ms` : ""}</span>
                    <span>{new Date(row.createdAt).toLocaleString("es-CO")}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta ────────────────────────────────────────────────────────────────

function HookCard({ hook }: { hook: HookItem }) {
  const [label, setLabel] = useState(hook.label);
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
      const res = await updateHook(hook.id, { label, url, events });
      if (res.error) flash("error", res.error);
      else flash("ok", "Cambios guardados.");
    });
  }

  function remove() {
    if (!confirm(`¿Eliminar el hook "${hook.label}"?`)) return;
    startTransition(async () => {
      const res = await deleteHook(hook.id);
      if (res.error) flash("error", res.error);
    });
  }

  function test() {
    startTransition(async () => {
      const res = await testHook(hook.id);
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
            {hook.label}
          </p>
        </div>
        <button
          type="button"
          onClick={() => startTransition(async () => { await toggleHook(hook.id, !hook.isActive); })}
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
        <label style={labelStyle}>Nombre</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>URL de destino</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://n8n.tudominio.com/webhook/geniorama"
          style={{ ...inputStyle, fontFamily: "monospace" }}
        />
      </div>

      <div>
        <label style={labelStyle}>Eventos suscritos</label>
        <EventPicker scope={hook.scope} selected={events} onChange={setEvents} />
      </div>

      <div>
        <label style={labelStyle}>Secreto de firma (HMAC SHA-256, cabecera X-Geniorama-Signature)</label>
        <input
          readOnly
          value={hook.secret}
          onFocus={(e) => e.currentTarget.select()}
          style={{ ...inputStyle, fontFamily: "monospace", color: "var(--app-text-muted)" }}
        />
      </div>

      {(hook.lastSentAt || hook.lastError) && (
        <p style={{ margin: 0, fontSize: "0.75rem", color: hook.lastError ? "#b91c1c" : "var(--app-text-muted)" }}>
          {hook.lastError
            ? `Último envío falló: ${hook.lastError}`
            : `Último envío: HTTP ${hook.lastStatus ?? "?"}`}
        </p>
      )}

      <Deliveries hookId={hook.id} />

      {msg && (
        <p style={{ margin: 0, fontSize: "0.8125rem", color: msg.kind === "ok" ? "#15803d" : "#b91c1c", display: "flex", alignItems: "center", gap: "0.375rem" }}>
          {msg.kind === "ok"
            ? <CheckCircle2 style={{ width: "0.875rem", height: "0.875rem" }} />
            : <XCircle style={{ width: "0.875rem", height: "0.875rem" }} />}
          {msg.text}
        </p>
      )}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" onClick={save} disabled={isPending} style={primaryButton(isPending)}>
          {isPending ? <Loader2 style={{ width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" }} /> : null}
          Guardar
        </button>
        <button type="button" onClick={test} disabled={isPending} style={secondaryButton}>
          <Send style={{ width: "0.875rem", height: "0.875rem" }} /> Probar
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={isPending}
          style={{ ...secondaryButton, color: "#b91c1c", marginLeft: "auto" }}
        >
          <Trash2 style={{ width: "0.875rem", height: "0.875rem" }} /> Eliminar
        </button>
      </div>
    </div>
  );
}

// ─── Alta ───────────────────────────────────────────────────────────────────

function NewHookForm({ scope, projectId }: { scope: "ORG" | "PROJECT"; projectId?: string }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await createHook({ label, url, events, scope, projectId });
      if (res.error) { setError(res.error); return; }
      setLabel(""); setUrl(""); setEvents([]); setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.5rem", alignSelf: "flex-start",
          padding: "0.625rem 1rem", borderRadius: "0.5rem", border: `1px dashed ${ACCENT}`,
          backgroundColor: `${ACCENT}10`, color: ACCENT, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
        }}
      >
        <Plus style={{ width: "1rem", height: "1rem" }} /> Agregar hook
      </button>
    );
  }

  return (
    <div style={{ ...cardStyle, borderStyle: "dashed" }}>
      <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)" }}>Nuevo hook</p>
      <div>
        <label style={labelStyle}>Nombre</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ej: n8n — avisos a WhatsApp"
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>URL de destino</label>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://n8n.tudominio.com/webhook/geniorama"
          style={{ ...inputStyle, fontFamily: "monospace" }}
        />
      </div>
      <div>
        <label style={labelStyle}>Eventos suscritos</label>
        <EventPicker scope={scope} selected={events} onChange={setEvents} />
      </div>
      {error && <p style={{ margin: 0, fontSize: "0.8125rem", color: "#b91c1c" }}>{error}</p>}
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="button" onClick={submit} disabled={isPending} style={primaryButton(isPending)}>
          {isPending ? <Loader2 style={{ width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" }} /> : null}
          Crear
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          disabled={isPending}
          style={{ ...secondaryButton, color: "var(--app-text-muted)" }}
        >
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
X-Geniorama-Event: ticket.status_changed
X-Geniorama-Delivery: evt_9f2c…
X-Geniorama-Signature: sha256=<hmac del cuerpo con tu secreto>

{
  "id": "evt_9f2c…",
  "event": "ticket.status_changed",
  "occurredAt": "2026-08-20T15:04:05.000Z",
  "actor": { "id": "ckx…", "name": "Ana Ruiz" },
  "changes": { "status": { "from": "ABIERTO", "to": "CERRADO" } },
  "data": {
    "id": "ckt…",
    "code": "ACM-42",
    "title": "Se cayó el sitio",
    "status": "CERRADO",
    "priority": "ALTA",
    "url": "https://app.geniorama.co/tickets/ckt…",
    "assignedTo": { "id": "cku…", "name": "Luis Gómez", "email": "luis@…" }
  }
}`;

  return (
    <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 1.25rem", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)" }}>
          ¿Qué recibe tu servicio?
        </span>
        {open
          ? <ChevronUp style={{ width: "1rem", height: "1rem", color: "var(--app-text-muted)" }} />
          : <ChevronDown style={{ width: "1rem", height: "1rem", color: "var(--app-text-muted)" }} />}
      </button>
      {open && (
        <div style={{ padding: "0 1.25rem 1.25rem", borderTop: "1px solid var(--app-border)" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--app-body-text)", lineHeight: 1.5 }}>
            Cada evento llega como un <strong>POST</strong> con JSON. Verifica la cabecera{" "}
            <code>X-Geniorama-Signature</code> con el secreto del hook antes de fiarte del cuerpo, y usa{" "}
            <code>X-Geniorama-Delivery</code> para descartar reintentos duplicados. Si tu servicio responde
            con un 5xx se reintenta una vez; con un 4xx, no.
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

export function HooksManager({
  hooks,
  scope,
  projectId,
}: {
  hooks: HookItem[];
  scope: "ORG" | "PROJECT";
  projectId?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <PayloadDocs />
      {hooks.map((hook) => (
        <HookCard key={hook.id} hook={hook} />
      ))}
      <NewHookForm scope={scope} projectId={projectId} />
    </div>
  );
}
