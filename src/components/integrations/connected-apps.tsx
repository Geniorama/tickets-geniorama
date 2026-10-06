"use client";

import { useState, useTransition } from "react";
import { Bot, Copy, Check, Unplug } from "lucide-react";
import { revokeConnectedApp, type ConnectedApp } from "@/actions/oauth.actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { OAUTH_SCOPE_LABELS, isOAuthScope } from "@/lib/oauth/config";
import { formatDateTime } from "@/lib/format-date";

const card: React.CSSProperties = {
  backgroundColor: "var(--app-card-bg)",
  border: "1px solid var(--app-border)",
  borderRadius: "0.75rem",
  padding: "1.25rem",
};

/**
 * Conectar asistentes de IA (Claude, ChatGPT, Cursor…) por MCP, y ver y
 * desconectar los que ya tienen acceso.
 */
export function ConnectedApps({ mcpUrl, apps }: { mcpUrl: string; apps: ConnectedApp[] }) {
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<ConnectedApp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function copy() {
    void navigator.clipboard.writeText(mcpUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function confirmRevoke() {
    if (!revoking) return;
    setError(null);
    startTransition(async () => {
      const res = await revokeConnectedApp(revoking.id);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setRevoking(null);
    });
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
        <Bot style={{ width: "1rem", height: "1rem", color: "#fd1384" }} />
        <h2 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)" }}>
          Asistentes de IA (MCP)
        </h2>
      </div>
      <p style={{ margin: "0 0 0.875rem", fontSize: "0.8125rem", color: "var(--app-text-muted)", lineHeight: 1.6 }}>
        Añade esta dirección como conector personalizado en Claude, ChatGPT o Cursor. Te pedirá iniciar sesión y
        autorizar el acceso; el asistente verá y hará solo lo que tú puedes hacer en la plataforma.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <code
          style={{
            flex: 1,
            minWidth: 0,
            overflowX: "auto",
            whiteSpace: "nowrap",
            fontSize: "0.8125rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--app-border)",
            backgroundColor: "var(--app-content-bg)",
            color: "var(--app-body-text)",
          }}
        >
          {mcpUrl}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label="Copiar dirección"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8125rem",
            padding: "0.5rem 0.75rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--app-border)",
            background: "none",
            color: "var(--app-body-text)",
            cursor: "pointer",
          }}
        >
          {copied ? <Check style={{ width: "0.875rem", height: "0.875rem" }} /> : <Copy style={{ width: "0.875rem", height: "0.875rem" }} />}
          {copied ? "Copiada" : "Copiar"}
        </button>
      </div>

      <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        Conectados
      </p>
      {apps.length === 0 ? (
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>Ningún asistente conectado todavía.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {apps.map((app) => (
            <li
              key={app.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                border: "1px solid var(--app-border)",
                borderRadius: "0.5rem",
                padding: "0.625rem 0.75rem",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)" }}>{app.name}</p>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                  {app.scopes.map((s) => (isOAuthScope(s) ? OAUTH_SCOPE_LABELS[s].label : s)).join(" · ")}
                  {" · "}
                  {app.lastUsedAt ? `Último uso ${formatDateTime(app.lastUsedAt)}` : `Conectado ${formatDateTime(app.createdAt)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setError(null); setRevoking(app); }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  flexShrink: 0,
                  fontSize: "0.8125rem",
                  padding: "0.375rem 0.625rem",
                  borderRadius: "0.375rem",
                  border: "1px solid rgba(239,68,68,0.3)",
                  background: "none",
                  color: "#dc2626",
                  cursor: "pointer",
                }}
              >
                <Unplug style={{ width: "0.875rem", height: "0.875rem" }} />
                Desconectar
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!revoking}
        title="Desconectar asistente"
        message={`«${revoking?.name ?? ""}» dejará de tener acceso a tu cuenta de inmediato. Para volver a usarlo tendrás que autorizarlo otra vez.`}
        confirmLabel="Desconectar"
        variant="danger"
        isPending={isPending}
        onConfirm={confirmRevoke}
        onCancel={() => { if (!isPending) setRevoking(null); }}
      >
        {error && <p role="alert" style={{ margin: 0, fontSize: "0.8125rem", color: "#dc2626" }}>{error}</p>}
      </ConfirmDialog>
    </div>
  );
}
