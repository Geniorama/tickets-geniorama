"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, LogIn, LogOut, X } from "lucide-react";
import { AgentChat } from "./agent-chat";
import type { AgentChatState, SendResult } from "@/lib/agent-chat-session";

const ACCENT = "#fd1384";
const TOKEN_KEY = "geniorama-agent-token";

/**
 * Los colores del modo claro, fijados aquí: el widget vive dentro de otra
 * página y debe verse igual aunque quien lo use tenga la plataforma en modo
 * oscuro. No se cambia el tema con next-themes porque el iframe comparte el
 * almacenamiento con la plataforma cuando se inserta en geniorama.co, y le
 * cambiaría el tema también allá.
 */
const LIGHT_VARS = {
  "--app-body-text": "#1a1a3e",
  "--app-content-bg": "#eef2ff",
  "--app-card-bg": "#ffffff",
  "--app-border": "rgba(0, 10, 61, 0.1)",
  "--app-text-muted": "rgba(0, 10, 61, 0.5)",
} as React.CSSProperties;

function readToken(): string | null {
  try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function writeToken(token: string | null) {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Sin almacenamiento el widget funciona igual, solo pide entrar en cada visita.
  }
}

type Phase =
  | { kind: "checking" }
  | { kind: "signed-out"; notice?: string }
  | { kind: "ready"; state: Extract<AgentChatState, { available: true }> }
  | { kind: "unavailable"; reason: string };

const iconButton: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: "1.875rem", height: "1.875rem", borderRadius: "0.5rem",
  border: "1px solid var(--app-border)", background: "none", color: "var(--app-body-text)", cursor: "pointer",
};

/** Le pide al script del sitio anfitrión que cierre el widget. */
function closeWidget() {
  window.parent?.postMessage({ type: "geniorama-widget-close" }, "*");
}

/**
 * El chat dentro del widget insertado en otros sitios. Sin sesión de la
 * plataforma (la cookie no llega a un iframe de terceros): la persona entra en
 * una ventana de la plataforma (`/embed/conectar`), que le devuelve a este
 * iframe un token firmado por `postMessage`. Solo se aceptan mensajes del
 * propio dominio de la plataforma y con el `nonce` de este intento.
 */
export function EmbedChat() {
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const tokenRef = useRef<string | null>(null);
  const nonceRef = useRef<string | null>(null);

  const load = useCallback(async (token: string) => {
    tokenRef.current = token;
    setPhase({ kind: "checking" });
    try {
      const res = await fetch("/api/embed/agent-chat", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (res.status === 401) {
        writeToken(null);
        tokenRef.current = null;
        setPhase({ kind: "signed-out", notice: "Tu sesión venció. Entra de nuevo." });
        return;
      }
      const state = (await res.json()) as AgentChatState;
      setPhase(state.available ? { kind: "ready", state } : { kind: "unavailable", reason: state.reason });
    } catch {
      setPhase({ kind: "signed-out", notice: "No pudimos conectar con Geniorama. Inténtalo de nuevo." });
    }
  }, []);

  useEffect(() => {
    const token = readToken();
    // El primer render siempre es «checking»; aquí se decide con lo guardado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (token) void load(token); else setPhase({ kind: "signed-out" });

    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      const data = e.data as { type?: string; nonce?: string; token?: string; reason?: string } | null;
      if (data?.type !== "geniorama-agent-auth" || !nonceRef.current || data.nonce !== nonceRef.current) return;
      nonceRef.current = null;
      if (data.token) {
        writeToken(data.token);
        void load(data.token);
      } else {
        setPhase({ kind: "unavailable", reason: data.reason ?? "No se pudo iniciar sesión." });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [load]);

  function signIn() {
    const nonce = crypto.randomUUID();
    nonceRef.current = nonce;
    const popup = window.open(`/embed/conectar?nonce=${nonce}`, "geniorama-login", "popup,width=460,height=680");
    if (!popup) {
      setPhase({ kind: "signed-out", notice: "Tu navegador bloqueó la ventana para entrar. Permite las ventanas emergentes de este sitio e inténtalo de nuevo." });
    }
  }

  function signOut() {
    writeToken(null);
    tokenRef.current = null;
    setPhase({ kind: "signed-out" });
  }

  const send = useCallback(async (conversationId: string | null, text: string): Promise<SendResult> => {
    const token = tokenRef.current;
    if (!token) return { error: "Inicia sesión de nuevo." };
    try {
      const res = await fetch("/api/embed/agent-chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      if (res.status === 401) {
        writeToken(null);
        tokenRef.current = null;
        setPhase({ kind: "signed-out", notice: "Tu sesión venció. Entra de nuevo." });
        return { error: "Tu sesión venció." };
      }
      return (await res.json()) as SendResult;
    } catch {
      return { error: "No pudimos comunicarnos con el asistente. Inténtalo en un momento." };
    }
  }, []);

  const sendAudio = useCallback(async (conversationId: string | null, audio: Blob): Promise<SendResult> => {
    const token = tokenRef.current;
    if (!token) return { error: "Inicia sesión de nuevo." };
    const form = new FormData();
    form.append("audio", audio, "nota");
    if (conversationId) form.append("conversationId", conversationId);
    try {
      const res = await fetch("/api/embed/agent-chat/audio", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      if (res.status === 401) {
        writeToken(null);
        tokenRef.current = null;
        setPhase({ kind: "signed-out", notice: "Tu sesión venció. Entra de nuevo." });
        return { error: "Tu sesión venció." };
      }
      return (await res.json()) as SendResult;
    } catch {
      return { error: "No pudimos enviar la nota de voz. Inténtalo en un momento." };
    }
  }, []);

  const closeButton = (
    <button type="button" onClick={closeWidget} title="Cerrar" aria-label="Cerrar" style={iconButton}>
      <X style={{ width: "0.875rem", height: "0.875rem" }} />
    </button>
  );

  return (
    <div style={{ ...LIGHT_VARS, height: "100dvh", display: "flex", flexDirection: "column", backgroundColor: "var(--app-card-bg)", color: "var(--app-body-text)" }}>
      {phase.kind === "ready" ? (
        <AgentChat
          userName={phase.state.name}
          initialConversationId={phase.state.conversationId}
          initialMessages={phase.state.messages}
          send={send}
          sendAudio={sendAudio}
          audio={phase.state.audio}
          height="100%"
          rounded={false}
          headerActions={
            <>
              <button type="button" onClick={signOut} title="Salir" aria-label="Salir" style={iconButton}>
                <LogOut style={{ width: "0.875rem", height: "0.875rem" }} />
              </button>
              {closeButton}
            </>
          }
        />
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderBottom: "1px solid var(--app-border)" }}>
            <span style={{ fontSize: "0.9375rem", fontWeight: 600 }}>GENIA</span>
            {closeButton}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "1.5rem", textAlign: "center" }}>
            {phase.kind === "checking" && <Loader2 style={{ width: "1.25rem", height: "1.25rem", color: ACCENT, animation: "spin 1s linear infinite" }} />}

            {phase.kind === "signed-out" && (
              <>
                <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>Hola 👋</p>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-text-muted)", lineHeight: 1.6, maxWidth: "20rem" }}>
                  Entra con tu cuenta de Geniorama para consultar tus tickets, proyectos, plan, sitios y facturas.
                </p>
                {phase.notice && <p role="status" style={{ margin: 0, fontSize: "0.8125rem", color: "#b45309", maxWidth: "20rem" }}>{phase.notice}</p>}
                <button
                  type="button"
                  onClick={signIn}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 600, padding: "0.625rem 1.25rem", borderRadius: "0.625rem", border: "none", backgroundColor: ACCENT, color: "#ffffff", cursor: "pointer" }}
                >
                  <LogIn style={{ width: "1rem", height: "1rem" }} />
                  Iniciar sesión
                </button>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--app-text-muted)", maxWidth: "20rem", lineHeight: 1.5 }}>
                  Se abre una ventana de Geniorama: tu contraseña no pasa por este sitio.
                </p>
              </>
            )}

            {phase.kind === "unavailable" && (
              <>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-text-muted)", lineHeight: 1.6, maxWidth: "20rem" }}>{phase.reason}</p>
                <button type="button" onClick={signOut} style={{ fontSize: "0.8125rem", padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "1px solid var(--app-border)", background: "none", color: "var(--app-body-text)", cursor: "pointer" }}>
                  Usar otra cuenta
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
