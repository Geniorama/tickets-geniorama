"use client";

/**
 * Llaves de la API.
 *
 * El token recién creado se enseña una sola vez y con aviso: no hay pantalla que
 * lo vuelva a mostrar porque en la base solo vive su hash. Todo lo demás de esta
 * pantalla existe para poder revocar con criterio — quién la usa, en nombre de
 * quién escribe y cuándo se usó por última vez.
 */

import { useState, useTransition } from "react";
import { KeyRound, Plus, Trash2, Loader2, Copy, Check, ShieldOff, AlertTriangle } from "lucide-react";
import {
  createApiKey, revokeApiKey, deleteApiKey,
  type ApiKeyItem,
} from "@/actions/api-key.actions";
import { API_SCOPES, API_SCOPE_LABELS, displayPrefix } from "@/lib/api/scopes";

const ACCENT = "#0891b2";

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
  padding: "1rem 1.25rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

type Candidate = { id: string; name: string; email: string; role: string };

// ─── Token recién creado ────────────────────────────────────────────────────

function FreshToken({ token, onDone }: { token: string; onDone: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sin portapapeles (http o permisos), el token está a la vista igualmente.
    }
  }

  return (
    <div
      style={{
        border: "1px solid #fcd34d",
        backgroundColor: "#fffbeb",
        borderRadius: "0.75rem",
        padding: "1rem 1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.875rem", color: "#92400e" }}>
        <AlertTriangle style={{ width: "1rem", height: "1rem" }} />
        Cópiala ahora: no se vuelve a mostrar
      </p>
      <code
        style={{
          display: "block",
          padding: "0.75rem",
          borderRadius: "0.5rem",
          backgroundColor: "#fff",
          border: "1px solid #fde68a",
          fontFamily: "monospace",
          fontSize: "0.8125rem",
          color: "#1f2937",
          wordBreak: "break-all",
        }}
      >
        {token}
      </code>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={copy}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", backgroundColor: "#92400e", color: "#fff", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" }}
        >
          {copied ? <Check style={{ width: "0.875rem", height: "0.875rem" }} /> : <Copy style={{ width: "0.875rem", height: "0.875rem" }} />}
          {copied ? "Copiada" : "Copiar"}
        </button>
        <button
          type="button"
          onClick={onDone}
          style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #fde68a", backgroundColor: "transparent", color: "#92400e", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" }}
        >
          Ya la guardé
        </button>
      </div>
    </div>
  );
}

// ─── Tarjeta ────────────────────────────────────────────────────────────────

function KeyCard({ item }: { item: ApiKeyItem }) {
  const [isPending, startTransition] = useTransition();
  const live = item.isActive && !item.isExpired;

  return (
    <div style={{ ...cardStyle, opacity: live ? 1 : 0.65 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0 }}>
          <div style={{ width: "2rem", height: "2rem", borderRadius: "0.5rem", backgroundColor: `${ACCENT}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <KeyRound style={{ width: "1rem", height: "1rem", color: ACCENT }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)" }}>
              {item.label}
            </p>
            <code style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", fontFamily: "monospace" }}>
              {displayPrefix(item.prefix)}
            </code>
          </div>
        </div>
        <span
          style={{
            fontSize: "0.7rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: "9999px", flexShrink: 0,
            backgroundColor: live ? "#dcfce7" : "#fee2e2",
            color: live ? "#15803d" : "#b91c1c",
          }}
        >
          {live ? "Activa" : item.isExpired ? "Vencida" : "Revocada"}
        </span>
      </div>

      <div style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", lineHeight: 1.6 }}>
        <div>
          Escribe como <strong style={{ color: "var(--app-body-text)" }}>{item.user.name}</strong> ({item.user.email})
        </div>
        <div>
          Permisos: {item.scopes.map((s) => <code key={s} style={{ marginRight: "0.375rem" }}>{s}</code>)}
        </div>
        <div>
          {item.lastUsedAt
            ? `Último uso: ${new Date(item.lastUsedAt).toLocaleString("es-CO")}`
            : "Todavía sin usar"}
          {item.expiresAt ? ` · Vence: ${new Date(item.expiresAt).toLocaleDateString("es-CO")}` : ""}
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        {live && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!confirm(`¿Revocar "${item.label}"? Dejará de funcionar de inmediato.`)) return;
              startTransition(async () => { await revokeApiKey(item.id); });
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.4rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--app-border)", backgroundColor: "var(--app-card-bg)", color: "#b45309", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" }}
          >
            <ShieldOff style={{ width: "0.875rem", height: "0.875rem" }} /> Revocar
          </button>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (!confirm(`¿Eliminar "${item.label}"? Se pierde también su rastro de uso.`)) return;
            startTransition(async () => { await deleteApiKey(item.id); });
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.4rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--app-border)", backgroundColor: "var(--app-card-bg)", color: "#b91c1c", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer", marginLeft: "auto" }}
        >
          <Trash2 style={{ width: "0.875rem", height: "0.875rem" }} /> Eliminar
        </button>
      </div>
    </div>
  );
}

// ─── Alta ───────────────────────────────────────────────────────────────────

function NewKeyForm({
  candidates,
  onCreated,
}: {
  candidates: Candidate[];
  onCreated: (token: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [userId, setUserId] = useState(candidates[0]?.id ?? "");
  const [scopes, setScopes] = useState<string[]>(["read", "write"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function toggleScope(scope: string) {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  }

  function submit() {
    setError("");
    startTransition(async () => {
      const res = await createApiKey({ label, userId, scopes, expiresAt: expiresAt || undefined });
      if (res.error) { setError(res.error); return; }
      if (res.token) onCreated(res.token);
      setLabel(""); setScopes(["read", "write"]); setExpiresAt(""); setOpen(false);
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
        <Plus style={{ width: "1rem", height: "1rem" }} /> Crear llave
      </button>
    );
  }

  return (
    <div style={{ ...cardStyle, borderStyle: "dashed", gap: "0.875rem" }}>
      <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)" }}>Nueva llave</p>

      <div>
        <label style={labelStyle}>Nombre</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ej: n8n — bot de WhatsApp"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Escribe en nombre de</label>
        <select value={userId} onChange={(e) => setUserId(e.target.value)} style={inputStyle}>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — {c.email}
            </option>
          ))}
        </select>
        <p style={{ margin: "0.375rem 0 0", fontSize: "0.7rem", color: "var(--app-text-muted)", lineHeight: 1.5 }}>
          La llave ve y escribe exactamente lo que vería esta persona en la plataforma. Para una
          integración del equipo, elige una cuenta de administrador; para una que solo deba tocar lo
          de un cliente, la cuenta de ese cliente.
        </p>
      </div>

      <div>
        <label style={labelStyle}>Permisos</label>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {API_SCOPES.map((scope) => (
            <label key={scope} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--app-body-text)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={scopes.includes(scope)}
                onChange={() => toggleScope(scope)}
                style={{ marginTop: "0.2rem" }}
              />
              <span>
                <strong>{API_SCOPE_LABELS[scope].label}</strong>{" "}
                <code style={{ fontSize: "0.7rem", color: "var(--app-text-muted)" }}>{scope}</code>
                <br />
                <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                  {API_SCOPE_LABELS[scope].description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>Vencimiento (opcional)</label>
        <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} style={inputStyle} />
      </div>

      {error && <p style={{ margin: 0, fontSize: "0.8125rem", color: "#b91c1c" }}>{error}</p>}

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", backgroundColor: ACCENT, color: "#fff", fontSize: "0.8125rem", fontWeight: 500, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.7 : 1 }}
        >
          {isPending ? <Loader2 style={{ width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" }} /> : null}
          Crear
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setError(""); }}
          disabled={isPending}
          style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid var(--app-border)", backgroundColor: "var(--app-card-bg)", color: "var(--app-text-muted)", fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer" }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Root ───────────────────────────────────────────────────────────────────

export function ApiKeys({
  keys,
  candidates,
}: {
  keys: ApiKeyItem[];
  candidates: Candidate[];
}) {
  const [fresh, setFresh] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {fresh && <FreshToken token={fresh} onDone={() => setFresh(null)} />}
      {keys.map((item) => (
        <KeyCard key={item.id} item={item} />
      ))}
      {keys.length === 0 && (
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>
          Todavía no hay llaves. Sin una, nadie puede entrar a <code>/api/v1</code>.
        </p>
      )}
      <NewKeyForm candidates={candidates} onCreated={setFresh} />
    </div>
  );
}
