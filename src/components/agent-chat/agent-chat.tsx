"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, MessageCircle, Plus, Send } from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { sendAgentChatMessage } from "@/actions/agent-chat.actions";
import type { AgentChatMessageView, SendResult } from "@/lib/agent-chat-session";

const ACCENT = "#fd1384";

const SUGGESTIONS = [
  "¿Cómo van mis tickets abiertos?",
  "¿Cuántas horas me quedan en el plan?",
  "Mi sitio no carga, ¿qué pasa?",
  "¿Tengo facturas pendientes?",
];

/**
 * La ventana de chat con el asistente de Geniorama. Quien responde es el
 * agente de n8n (ver `src/lib/agent-chat.ts`); aquí solo se conversa.
 *
 * La usan la página `/mi-asistente`, el widget flotante de la plataforma y el
 * widget insertado en otros sitios. Este último no tiene sesión, así que pasa
 * su propio `send` (con el token del widget) en vez de la acción de servidor.
 */
export function AgentChat({
  userName, initialConversationId, initialMessages,
  send: sendMessage = sendAgentChatMessage,
  height = "calc(100vh - 11rem)",
  rounded = true,
  headerActions,
}: {
  userName: string;
  initialConversationId: string | null;
  initialMessages: AgentChatMessageView[];
  send?: (conversationId: string | null, text: string) => Promise<SendResult>;
  height?: string;
  /** Borde y esquinas redondeadas; el widget los pone por fuera. */
  rounded?: boolean;
  /** Botones extra en la cabecera (cerrar, salir…). */
  headerActions?: React.ReactNode;
}) {
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [pending, setPending] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending, error]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isPending) return;
    setError(null);
    setPending(trimmed);
    setInput("");
    startTransition(async () => {
      const res = await sendMessage(conversationId, trimmed);
      setPending(null);
      if ("error" in res) {
        setError(res.error);
        // Se devuelve el texto al cuadro para reenviarlo sin reescribirlo.
        setInput(trimmed);
        return;
      }
      setConversationId(res.conversationId);
      setMessages((prev) => [...prev, res.user, res.reply]);
      inputRef.current?.focus();
    });
  }

  function newConversation() {
    if (isPending) return;
    setConversationId(null);
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  }

  const empty = messages.length === 0 && !pending;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height,
        minHeight: rounded ? "28rem" : 0,
        backgroundColor: "var(--app-card-bg)",
        border: rounded ? "1px solid var(--app-border)" : "none",
        borderRadius: rounded ? "1rem" : 0,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.75rem 1.25rem", borderBottom: "1px solid var(--app-border)", flexShrink: 0 }}>
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "2rem", height: "2rem", borderRadius: "0.5rem", backgroundColor: "rgba(253,19,132,0.1)" }}>
          <MessageCircle style={{ width: "1rem", height: "1rem", color: ACCENT }} />
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)", lineHeight: 1.3 }}>GENIA</p>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--app-text-muted)", lineHeight: 1.3 }}>El asistente de Geniorama</p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.375rem" }}>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={newConversation}
            disabled={isPending}
            title="Nueva conversación"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", padding: "0.375rem 0.625rem", borderRadius: "0.5rem", border: "1px solid var(--app-border)", background: "none", color: "var(--app-body-text)", cursor: isPending ? "default" : "pointer", opacity: isPending ? 0.5 : 1 }}
          >
            <Plus style={{ width: "0.875rem", height: "0.875rem" }} />
            Nueva
          </button>
        )}
        {headerActions}
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "1.25rem 1rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {empty && (
          <div style={{ maxWidth: "28rem", margin: "1.5rem auto 0", textAlign: "center" }}>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--app-body-text)" }}>{userName.trim() ? `Hola, ${userName.trim().split(" ")[0]}` : "Hola"}</p>
            <p style={{ margin: "0.25rem 0 1.25rem", fontSize: "0.875rem", color: "var(--app-text-muted)", lineHeight: 1.55 }}>
              Soy GENIA, el asistente de Geniorama. Pregúntame por tus tickets, proyectos, horas del plan, sitios o facturas. Si hace falta, abro un
              ticket para el equipo.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  style={{ textAlign: "left", fontSize: "0.875rem", padding: "0.625rem 0.875rem", borderRadius: "0.5rem", border: "1px solid var(--app-border)", backgroundColor: "var(--app-content-bg)", color: "var(--app-body-text)", cursor: "pointer" }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => <Bubble key={m.id} role={m.role} content={m.content} />)}
        {pending && <Bubble role="user" content={pending} />}

        {isPending && (
          <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "var(--app-text-muted)", padding: "0.625rem 1rem", borderRadius: "1rem", border: "1px solid var(--app-border)", backgroundColor: "var(--app-content-bg)" }}>
            <span style={{ width: "0.875rem", height: "0.875rem", border: "2px solid var(--app-border)", borderTopColor: ACCENT, borderRadius: "9999px", animation: "spin 1s linear infinite" }} />
            Revisando tu información…
          </div>
        )}

        {error && (
          <p role="alert" style={{ alignSelf: "stretch", display: "flex", alignItems: "center", gap: "0.5rem", margin: 0, fontSize: "0.8125rem", color: "#dc2626", backgroundColor: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: "0.5rem", padding: "0.625rem 0.875rem" }}>
            <AlertCircle style={{ width: "1rem", height: "1rem", flexShrink: 0 }} />
            {error}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", padding: "0.75rem 1rem", borderTop: "1px solid var(--app-border)", flexShrink: 0 }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Escribe tu mensaje…"
          aria-label="Mensaje para el asistente"
          style={{ flex: 1, resize: "none", maxHeight: "8rem", fontSize: "0.875rem", padding: "0.625rem 0.875rem", borderRadius: "0.75rem", border: "1px solid var(--app-border)", backgroundColor: "var(--app-content-bg)", color: "var(--app-body-text)", outline: "none", fontFamily: "inherit" }}
        />
        <button
          type="submit"
          disabled={isPending || !input.trim()}
          aria-label="Enviar"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "2.5rem", height: "2.5rem", borderRadius: "0.75rem", border: "none", backgroundColor: ACCENT, color: "#ffffff", cursor: "pointer", opacity: isPending || !input.trim() ? 0.4 : 1, flexShrink: 0 }}
        >
          <Send style={{ width: "1rem", height: "1rem" }} />
        </button>
      </form>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  if (role === "user") {
    return (
      <div style={{ alignSelf: "flex-end", maxWidth: "80%", fontSize: "0.875rem", lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#ffffff", backgroundColor: ACCENT, borderRadius: "1rem 1rem 0.25rem 1rem", padding: "0.625rem 1rem" }}>
        {content}
      </div>
    );
  }
  return (
    <div style={{ alignSelf: "flex-start", maxWidth: "88%", fontSize: "0.875rem", wordBreak: "break-word", backgroundColor: "var(--app-content-bg)", border: "1px solid var(--app-border)", borderRadius: "1rem 1rem 1rem 0.25rem", padding: "0.75rem 1rem 0.25rem" }}>
      <MarkdownRenderer content={content} />
    </div>
  );
}
