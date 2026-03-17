"use client";

import { useState, useTransition } from "react";
import {
  MessageSquare, Ticket, ListTodo, Bell, AtSign,
  CheckCircle2, XCircle, Loader2, Trash2, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";
import { saveSetting, deleteSetting } from "@/actions/settings.actions";

// ─── Config de canales ────────────────────────────────────────────────────────

const CHANNELS = [
  {
    key: "gchat_webhook_tickets",
    label: "Canal de Tickets",
    icon: Ticket,
    color: "#6366f1",
    description: "Recibe alertas cuando un cliente abre un ticket nuevo, cuando se asigna un ticket a un colaborador o cuando su estado cambia.",
    events: ["Ticket nuevo (creado por cliente)", "Ticket asignado a colaborador", "Cambio de estado de ticket", "Cambio de fecha límite"],
  },
  {
    key: "gchat_webhook_tasks",
    label: "Canal de Tareas",
    icon: ListTodo,
    color: "#0ea5e9",
    description: "Recibe alertas de asignaciones de tareas y cuando una tarea es marcada como completada.",
    events: ["Tarea asignada a un usuario", "Tarea marcada como completada", "Cambio de fecha de inicio o fecha límite"],
  },
  {
    key: "gchat_webhook_comments",
    label: "Canal de Comentarios",
    icon: MessageSquare,
    color: "#10b981",
    description: "Recibe una alerta cada vez que alguien comenta en un ticket o en una tarea.",
    events: ["Comentario nuevo en ticket", "Comentario nuevo en tarea"],
  },
  {
    key: "gchat_webhook_mentions",
    label: "Canal de Menciones",
    icon: AtSign,
    color: "#f59e0b",
    description: "Recibe una alerta cuando alguien menciona a un usuario con @ en un comentario.",
    events: ["Mención con @ en ticket o tarea"],
  },
] as const;

// ─── Canal individual ─────────────────────────────────────────────────────────

function ChannelCard({
  channel,
  saved,
}: {
  channel: typeof CHANNELS[number];
  saved: string;
}) {
  const [value, setValue] = useState(saved);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const Icon = channel.icon;
  const configured = Boolean(saved);

  function handleSave() {
    setStatus("idle");
    startTransition(async () => {
      const trimmed = value.trim();
      if (!trimmed) {
        const res = await deleteSetting(channel.key);
        if (res.error) { setStatus("error"); setErrorMsg(res.error); }
        else setStatus("ok");
        return;
      }
      const res = await saveSetting(channel.key, trimmed);
      if (res.error) { setStatus("error"); setErrorMsg(res.error); }
      else setStatus("ok");
    });
  }

  function handleClear() {
    setValue("");
    startTransition(async () => {
      await deleteSetting(channel.key);
      setStatus("ok");
    });
  }

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: `1px solid var(--app-border)`,
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}
    >
      {/* Header */}
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
            width: "2rem",
            height: "2rem",
            borderRadius: "0.5rem",
            backgroundColor: `${channel.color}20`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon style={{ width: "1rem", height: "1rem", color: channel.color }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)" }}>
            {channel.label}
          </p>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.125rem" }}>
            {channel.description}
          </p>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.75rem",
            fontWeight: 500,
            padding: "0.25rem 0.625rem",
            borderRadius: "9999px",
            backgroundColor: configured ? "#dcfce7" : "var(--app-content-bg)",
            color: configured ? "#15803d" : "var(--app-text-muted)",
            border: `1px solid ${configured ? "#bbf7d0" : "var(--app-border)"}`,
            flexShrink: 0,
          }}
        >
          {configured
            ? <><CheckCircle2 style={{ width: "0.75rem", height: "0.75rem" }} /> Activo</>
            : <><XCircle style={{ width: "0.75rem", height: "0.75rem" }} /> Sin configurar</>
          }
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {/* Events list */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
          {channel.events.map((e) => (
            <span
              key={e}
              style={{
                fontSize: "0.6875rem",
                padding: "0.2rem 0.5rem",
                borderRadius: "0.25rem",
                backgroundColor: `${channel.color}15`,
                color: channel.color,
                fontWeight: 500,
              }}
            >
              {e}
            </span>
          ))}
        </div>

        {/* Webhook URL input */}
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <input
            type="url"
            value={value}
            onChange={(e) => { setValue(e.target.value); setStatus("idle"); }}
            placeholder="https://chat.googleapis.com/v1/spaces/.../messages?key=..."
            style={{
              flex: 1,
              fontSize: "0.8125rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--app-border)",
              backgroundColor: "var(--app-content-bg)",
              color: "var(--app-body-text)",
              outline: "none",
              fontFamily: "monospace",
              minWidth: 0,
            }}
          />
          {value && (
            <button
              type="button"
              onClick={handleClear}
              disabled={isPending}
              title="Limpiar"
              style={{
                padding: "0.5rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--app-border)",
                backgroundColor: "var(--app-card-bg)",
                color: "var(--app-text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Trash2 style={{ width: "0.875rem", height: "0.875rem" }} />
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "none",
              backgroundColor: channel.color,
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
              : "Guardar"
            }
          </button>
        </div>

        {status === "ok" && (
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#15803d", display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <CheckCircle2 style={{ width: "0.875rem", height: "0.875rem" }} />
            {value.trim() ? "Webhook guardado correctamente." : "Webhook eliminado."}
          </p>
        )}
        {status === "error" && (
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "#b91c1c" }}>{errorMsg}</p>
        )}
      </div>
    </div>
  );
}

// ─── Instrucciones ────────────────────────────────────────────────────────────

function Instructions() {
  const [open, setOpen] = useState(false);

  const steps = [
    { n: 1, text: "Abre Google Chat en el navegador (chat.google.com)." },
    { n: 2, text: "Entra al espacio donde quieres recibir las notificaciones. Puedes crear uno nuevo, por ejemplo: \"Geniorama – Tickets\"." },
    { n: 3, text: "Haz clic en el nombre del espacio en la parte superior para abrir el menú." },
    { n: 4, text: "Selecciona \"Apps & integrations\" (Aplicaciones e integraciones)." },
    { n: 5, text: "Haz clic en \"Add webhooks\"." },
    { n: 6, text: "Ponle un nombre al webhook (ej: Geniorama) y guarda." },
    { n: 7, text: "Copia la URL generada y pégala en el campo del canal correspondiente arriba." },
    { n: 8, text: "Repite los pasos para cada canal que quieras activar." },
  ];

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
          <Bell style={{ width: "1rem", height: "1rem", color: "#6366f1" }} />
          <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)" }}>
            ¿Cómo obtener la URL del webhook?
          </span>
        </div>
        {open
          ? <ChevronUp style={{ width: "1rem", height: "1rem", color: "var(--app-text-muted)", flexShrink: 0 }} />
          : <ChevronDown style={{ width: "1rem", height: "1rem", color: "var(--app-text-muted)", flexShrink: 0 }} />
        }
      </button>

      {open && (
        <div style={{ padding: "0 1.25rem 1.25rem", borderTop: "1px solid var(--app-border)" }}>
          <ol style={{ margin: "1rem 0 0", paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {steps.map(({ n, text }) => (
              <li key={n} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                <span
                  style={{
                    width: "1.375rem",
                    height: "1.375rem",
                    borderRadius: "9999px",
                    backgroundColor: "#6366f1",
                    color: "#fff",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "0.1rem",
                  }}
                >
                  {n}
                </span>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-body-text)", lineHeight: 1.5 }}>{text}</p>
              </li>
            ))}
          </ol>

          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              backgroundColor: "#fef9c3",
              border: "1px solid #fde047",
              fontSize: "0.8125rem",
              color: "#854d0e",
            }}
          >
            <strong>Nota:</strong> Si la opción «Add webhooks» no aparece, un administrador de Google Workspace debe habilitarla en{" "}
            <a
              href="https://admin.google.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#854d0e", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}
            >
              admin.google.com <ExternalLink style={{ width: "0.75rem", height: "0.75rem" }} />
            </a>
            {" "}→ Apps → Google Workspace → Google Chat → Settings.
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export function GChatIntegrations({ settings }: { settings: Record<string, string> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <Instructions />
      {CHANNELS.map((ch) => (
        <ChannelCard key={ch.key} channel={ch} saved={settings[ch.key] ?? ""} />
      ))}
    </div>
  );
}
