"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { X, Maximize2, Loader2 } from "lucide-react";
import { GenieIcon } from "@/components/ui/genie-icon";
import { getMyAgentChat, type AgentChatState } from "@/actions/agent-chat.actions";
import { AgentChat } from "./agent-chat";

const ACCENT = "#fd1384";

const iconButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "1.875rem",
  height: "1.875rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--app-border)",
  background: "none",
  color: "var(--app-body-text)",
  cursor: "pointer",
};

/**
 * El asistente de Geniorama a mano en cualquier pantalla: un botón flotante
 * que abre el chat en un panel. La conversación es la misma que la de
 * `/mi-asistente`; se carga al abrirlo la primera vez y se vuelve a cargar si
 * se cierra y se abre, por si se siguió en otra pestaña.
 */
export function AgentChatFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AgentChatState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isLoading, startLoad] = useTransition();

  if (pathname === "/mi-asistente" || pathname.startsWith("/mi-asistente/")) return null;

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoadError(false);
    startLoad(async () => {
      try {
        setState(await getMyAgentChat());
      } catch {
        setLoadError(true);
      }
    });
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="GENIA"
          className="no-print"
          style={{
            position: "fixed",
            right: "1rem",
            bottom: "5.5rem",
            zIndex: 9200,
            width: "min(26rem, calc(100vw - 2rem))",
            height: "min(38rem, calc(100vh - 7.5rem))",
            display: "flex",
            flexDirection: "column",
            borderRadius: "1rem",
            border: "1px solid var(--app-border)",
            backgroundColor: "var(--app-card-bg)",
            boxShadow: "0 24px 48px rgba(0,0,0,0.18)",
            overflow: "hidden",
          }}
        >
          {state?.available && !isLoading ? (
            <AgentChat
              key={state.conversationId ?? "nueva"}
              userName={state.name}
              initialConversationId={state.conversationId}
              initialMessages={state.messages}
              audio={state.audio}
              height="100%"
              rounded={false}
              headerActions={
                <>
                  <Link href="/mi-asistente" title="Abrir en pantalla completa" aria-label="Abrir en pantalla completa" style={iconButton} onClick={() => setOpen(false)}>
                    <Maximize2 style={{ width: "0.875rem", height: "0.875rem" }} />
                  </Link>
                  <button type="button" onClick={() => setOpen(false)} title="Cerrar" aria-label="Cerrar" style={iconButton}>
                    <X style={{ width: "0.875rem", height: "0.875rem" }} />
                  </button>
                </>
              }
            />
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", textAlign: "center", fontSize: "0.875rem", color: "var(--app-text-muted)", lineHeight: 1.6 }}>
              {isLoading || !state
                ? loadError
                  ? "No se pudo abrir el asistente. Inténtalo de nuevo."
                  : <Loader2 style={{ width: "1.25rem", height: "1.25rem", animation: "spin 1s linear infinite" }} />
                : !state.available && state.reason}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        aria-label={open ? "Cerrar GENIA" : "Abrir GENIA"}
        aria-expanded={open}
        title="GENIA"
        data-tour-id="agent-chat-fab"
        className="no-print"
        style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          zIndex: 9100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "3.25rem",
          height: "3.25rem",
          borderRadius: "9999px",
          border: "none",
          backgroundColor: ACCENT,
          color: "#ffffff",
          cursor: "pointer",
          boxShadow: "0 12px 28px rgba(253,19,132,0.4)",
        }}
      >
        {open ? <X style={{ width: "1.375rem", height: "1.375rem" }} /> : <GenieIcon style={{ width: "1.625rem", height: "1.625rem" }} />}
      </button>
    </>
  );
}
