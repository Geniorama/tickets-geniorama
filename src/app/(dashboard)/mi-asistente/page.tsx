import Link from "next/link";
import { redirect } from "next/navigation";
import { getRequiredSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { findClient } from "@/lib/api/agent";
import { getAgentChatConfig } from "@/lib/agent-chat";
import { AgentChat } from "@/components/agent-chat/agent-chat";

export const metadata = { title: "Asistente Geniorama" };

/** Cuántos mensajes de la última conversación se recuperan al entrar. */
const RESUME_LIMIT = 100;

export default async function MiAsistentePage() {
  const session = await getRequiredSession();
  if (session.user.role !== "CLIENTE") redirect("/dashboard");
  const userId = session.user.id;

  const [client, config, last] = await Promise.all([
    findClient({ id: userId }),
    getAgentChatConfig(),
    prisma.agentChatMessage.findFirst({ where: { userId }, orderBy: { createdAt: "desc" }, select: { conversationId: true } }),
  ]);

  const unavailable = !client.ok || !client.agentEnabled
    ? <>Tu plan no incluye el asistente. Si quieres activarlo, escríbele al equipo de Geniorama o revisa <Link href="/mis-planes" style={{ color: "#fd1384" }}>Mis planes</Link>.</>
    : !config.ready
      ? "El asistente estará disponible muy pronto: el equipo de Geniorama lo está terminando de configurar."
      : null;

  if (unavailable) {
    return (
      <div style={{ maxWidth: "40rem" }}>
        <h1 style={{ margin: "0 0 0.75rem", fontSize: "1.25rem", fontWeight: 700, color: "var(--app-body-text)" }}>Asistente Geniorama</h1>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-text-muted)", lineHeight: 1.6 }}>{unavailable}</p>
      </div>
    );
  }

  const messages = last
    ? await prisma.agentChatMessage.findMany({
        where: { userId, conversationId: last.conversationId },
        orderBy: { createdAt: "desc" },
        take: RESUME_LIMIT,
        select: { id: true, role: true, content: true, createdAt: true },
      })
    : [];

  return (
    <div style={{ maxWidth: "52rem" }}>
      <AgentChat
        userName={session.user.name ?? ""}
        initialConversationId={last?.conversationId ?? null}
        initialMessages={messages.reverse().map((m) => ({
          id: m.id,
          role: m.role === "assistant" ? "assistant" as const : "user" as const,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
