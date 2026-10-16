"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Circle, Copy, Check, Loader2, KeyRound } from "lucide-react";
import { saveSetting, deleteSetting } from "@/actions/settings.actions";
import { generateAgentChatSecret, setAgentChatKey, setAgentChatEmbedOrigins } from "@/actions/agent-chat.actions";
import { AGENT_CHAT_URL_KEY } from "@/lib/agent-chat-keys";

/**
 * El canal de chat dentro de la plataforma: a qué webhook de n8n se reenvía
 * cada mensaje, con qué secreto se firma y para qué llave del agente se emite
 * el token del cliente. El agente es el mismo que atiende por WhatsApp.
 */

const card: React.CSSProperties = {
  backgroundColor: "var(--app-card-bg)",
  border: "1px solid var(--app-border)",
  borderRadius: "0.75rem",
  padding: "1rem 1.25rem",
};

const input: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: "0.8125rem",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.375rem",
  border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-content-bg)",
  color: "var(--app-body-text)",
  outline: "none",
};

const button: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  flexShrink: 0,
  fontSize: "0.8125rem",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.375rem",
  border: "1px solid var(--app-border)",
  background: "none",
  color: "var(--app-body-text)",
  cursor: "pointer",
};

const label: React.CSSProperties = { display: "block", fontSize: "0.75rem", fontWeight: 500, color: "var(--app-text-muted)", marginBottom: "0.25rem" };
const spin = { width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" };

type Notice = { kind: "ok" | "error"; text: string } | null;

function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return (
    <p role={notice.kind === "error" ? "alert" : "status"} style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: notice.kind === "error" ? "#dc2626" : "#15803d" }}>
      {notice.text}
    </p>
  );
}

export function AgentChatSettings({
  url, secretConfigured, keyId, keys, ready, availableClients, embedOrigins, appOrigin,
}: {
  url: string | null;
  secretConfigured: boolean;
  keyId: string | null;
  keys: { id: string; label: string }[];
  ready: boolean;
  /** Clientes con un plan vigente que incluye el agente: a ellos se les muestra el chat. */
  availableClients: number;
  /** Sitios autorizados a mostrar el widget. */
  embedOrigins: string[];
  appOrigin: string;
}) {
  const [originsValue, setOriginsValue] = useState(embedOrigins.join("\n"));
  const [savedOrigins, setSavedOrigins] = useState(embedOrigins.join("\n"));
  const [originsNotice, setOriginsNotice] = useState<Notice>(null);
  const [savingOrigins, startOrigins] = useTransition();
  const [snippetCopied, setSnippetCopied] = useState(false);
  const snippet = `<script src="${appOrigin}/embed/widget.js" defer></script>`;

  function saveOrigins() {
    setOriginsNotice(null);
    startOrigins(async () => {
      const res = await setAgentChatEmbedOrigins(originsValue);
      if ("error" in res) return setOriginsNotice({ kind: "error", text: res.error });
      const text = res.origins.join("\n");
      setOriginsValue(text);
      setSavedOrigins(text);
      setOriginsNotice({ kind: "ok", text: res.origins.length ? `Guardado: ${res.origins.length} sitio(s).` : "Sin sitios: el widget solo funciona dentro de la plataforma." });
    });
  }

  function copySnippet() {
    void navigator.clipboard.writeText(snippet).then(() => {
      setSnippetCopied(true);
      setTimeout(() => setSnippetCopied(false), 1500);
    });
  }

  const [urlValue, setUrlValue] = useState(url ?? "");
  const [savedUrl, setSavedUrl] = useState(url ?? "");
  const [urlNotice, setUrlNotice] = useState<Notice>(null);
  const [savingUrl, startUrl] = useTransition();

  const [hasSecret, setHasSecret] = useState(secretConfigured);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [secretNotice, setSecretNotice] = useState<Notice>(null);
  const [generating, startSecret] = useTransition();

  const [selectedKey, setSelectedKey] = useState(keyId ?? "");
  const [keyNotice, setKeyNotice] = useState<Notice>(null);
  const [savingKey, startKey] = useTransition();

  function saveUrl() {
    setUrlNotice(null);
    const next = urlValue.trim();
    if (next && !/^https:\/\//i.test(next)) {
      setUrlNotice({ kind: "error", text: "Debe ser una URL https (el webhook de producción de n8n)." });
      return;
    }
    startUrl(async () => {
      const res = next ? await saveSetting(AGENT_CHAT_URL_KEY, next) : await deleteSetting(AGENT_CHAT_URL_KEY);
      if (res.error) return setUrlNotice({ kind: "error", text: res.error });
      setSavedUrl(next);
      setUrlNotice({ kind: "ok", text: next ? "Guardado" : "Borrado: el chat deja de mostrarse a los clientes." });
    });
  }

  function generate() {
    setSecretNotice(null);
    startSecret(async () => {
      const res = await generateAgentChatSecret();
      if ("error" in res) return setSecretNotice({ kind: "error", text: res.error });
      setSecret(res.secret);
      setHasSecret(true);
    });
  }

  function copySecret() {
    if (!secret) return;
    void navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function chooseKey(id: string) {
    setSelectedKey(id);
    setKeyNotice(null);
    startKey(async () => {
      const res = await setAgentChatKey(id);
      setKeyNotice(res.error ? { kind: "error", text: res.error } : { kind: "ok", text: "Guardado" });
    });
  }

  const status = ready
    ? { Icon: CheckCircle2, color: "#16a34a", text: `Activo: lo ven ${availableClients} cliente(s) en el menú, como «GENIA».` }
    : { Icon: Circle, color: "#9ca3af", text: "Inactivo: los clientes no lo ven hasta completar lo de abajo." };

  return (
    <div style={card}>
      <p style={{ margin: "0 0 0.25rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)" }}>Chat en la plataforma</p>
      <p style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: "var(--app-text-muted)", lineHeight: 1.55 }}>
        Los clientes con el agente en su plan también pueden escribirle sin WhatsApp: desde el botón flotante de la
        plataforma, desde «GENIA» en el menú o desde el widget en otros sitios. Cada mensaje se reenvía
        al webhook de n8n con el token del cliente ya firmado, y la respuesta se muestra en el chat.
      </p>
      <p style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: "0 0 1rem", fontSize: "0.8125rem", color: "var(--app-body-text)" }}>
        <status.Icon style={{ width: "1rem", height: "1rem", color: status.color, flexShrink: 0 }} />
        {status.text}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        <div>
          <label style={label} htmlFor="agent-chat-url">Webhook del workflow en n8n (Production URL)</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              id="agent-chat-url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              placeholder="https://n8n.tu-dominio.com/webhook/agente-web"
              style={input}
            />
            <button type="button" onClick={saveUrl} disabled={savingUrl || urlValue.trim() === savedUrl} style={{ ...button, opacity: savingUrl || urlValue.trim() === savedUrl ? 0.5 : 1 }}>
              {savingUrl && <Loader2 style={spin} />}
              Guardar
            </button>
          </div>
          <NoticeLine notice={urlNotice} />
        </div>

        <div>
          <span style={label}>Secreto de firma</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.8125rem", color: hasSecret ? "#15803d" : "var(--app-text-muted)" }}>
              {hasSecret ? "Configurado" : "Sin generar"}
            </span>
            <button type="button" onClick={generate} disabled={generating} style={{ ...button, padding: "0.375rem 0.625rem", fontSize: "0.75rem" }}>
              {generating ? <Loader2 style={spin} /> : <KeyRound style={{ width: "0.75rem", height: "0.75rem" }} />}
              {hasSecret ? "Generar uno nuevo" : "Generar"}
            </button>
          </div>
          {secret && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
              <p style={{ margin: "0 0 0.25rem" }}>
                Cópialo ahora en n8n: no se vuelve a mostrar. {secretConfigured && "El anterior deja de valer."}
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <code style={{ ...input, fontFamily: "var(--font-mono, monospace)", overflowX: "auto", whiteSpace: "nowrap" }}>{secret}</code>
                <button type="button" onClick={copySecret} style={button}>
                  {copied ? <Check style={{ width: "0.875rem", height: "0.875rem" }} /> : <Copy style={{ width: "0.875rem", height: "0.875rem" }} />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>
          )}
          <NoticeLine notice={secretNotice} />
        </div>

        <div>
          <label style={label} htmlFor="agent-chat-key">Llave del agente (la que usa el workflow para llamar a la API)</label>
          {keys.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>
              Primero crea la llave con el permiso «Agente de atención a clientes» (paso 2 de arriba).
            </p>
          ) : (
            <>
              <select id="agent-chat-key" value={selectedKey} onChange={(e) => chooseKey(e.target.value)} disabled={savingKey} style={{ ...input, flex: "none", width: "100%" }}>
                {!selectedKey && <option value="">Elige una llave</option>}
                {keys.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                El token del cliente solo vale con esta llave: si el workflow usa otra, las herramientas responden
                «client_token_invalido».
              </p>
            </>
          )}
          <NoticeLine notice={keyNotice} />
        </div>

        <div style={{ borderTop: "1px solid var(--app-border)", paddingTop: "0.875rem" }}>
          <p style={{ margin: "0 0 0.25rem", fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-body-text)" }}>Insertar en otro sitio (p. ej. la página web)</p>
          <p style={{ margin: "0 0 0.625rem", fontSize: "0.75rem", color: "var(--app-text-muted)", lineHeight: 1.55 }}>
            Pega esta línea antes de <code>&lt;/body&gt;</code>. Aparece un botón flotante; para conversar, la persona entra con
            su cuenta de Geniorama en una ventana de la plataforma (su contraseña no pasa por el sitio) y solo ve lo suyo.
            Dentro de la plataforma, los clientes ya tienen el mismo botón.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
            <code style={{ ...input, fontFamily: "var(--font-mono, monospace)", overflowX: "auto", whiteSpace: "nowrap" }}>{snippet}</code>
            <button type="button" onClick={copySnippet} style={button}>
              {snippetCopied ? <Check style={{ width: "0.875rem", height: "0.875rem" }} /> : <Copy style={{ width: "0.875rem", height: "0.875rem" }} />}
              {snippetCopied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <label style={label} htmlFor="agent-chat-origins">Sitios autorizados (uno por línea)</label>
          <textarea
            id="agent-chat-origins"
            value={originsValue}
            onChange={(e) => setOriginsValue(e.target.value)}
            rows={3}
            placeholder={"https://geniorama.co\nhttps://www.geniorama.co"}
            style={{ ...input, width: "100%", resize: "vertical", fontFamily: "var(--font-mono, monospace)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginTop: "0.375rem" }}>
            <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--app-text-muted)", lineHeight: 1.5 }}>
              En cualquier otro sitio el widget muestra «no autorizado». Cuentan el dominio exacto: con y sin «www» son dos.
            </p>
            <button type="button" onClick={saveOrigins} disabled={savingOrigins || originsValue.trim() === savedOrigins.trim()} style={{ ...button, opacity: savingOrigins || originsValue.trim() === savedOrigins.trim() ? 0.5 : 1 }}>
              {savingOrigins && <Loader2 style={spin} />}
              Guardar
            </button>
          </div>
          <NoticeLine notice={originsNotice} />
        </div>
      </div>
    </div>
  );
}
