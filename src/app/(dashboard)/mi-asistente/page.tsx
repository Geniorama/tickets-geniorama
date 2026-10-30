import Link from "next/link";
import { getRequiredSession } from "@/lib/auth-helpers";
import { loadAgentChat } from "@/lib/agent-chat-session";
import { AgentChat } from "@/components/agent-chat/agent-chat";

export const metadata = { title: "GENIA" };

export default async function MiAsistentePage() {
  const session = await getRequiredSession();
  const state = await loadAgentChat(session.user.id);

  if (!state.available) {
    return (
      <div style={{ maxWidth: "40rem" }}>
        <h1 style={{ margin: "0 0 0.75rem", fontSize: "1.25rem", fontWeight: 700, color: "var(--app-body-text)" }}>GENIA</h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-text-muted)", lineHeight: 1.6 }}>
          {state.reason}{" "}
          {session.user.role === "CLIENTE" && <Link href="/mis-planes" style={{ color: "#fd1384" }}>Ver mis planes</Link>}
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "52rem" }}>
      <AgentChat
        userName={session.user.name ?? state.name}
        initialConversationId={state.conversationId}
        initialMessages={state.messages}
        audio={state.audio}
      />
    </div>
  );
}
