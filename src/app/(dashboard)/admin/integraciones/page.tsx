import { requireCan } from "@/lib/access/can";
import { getSettings } from "@/actions/settings.actions";
import { listBriefRoutings, listAssignableStaff } from "@/lib/brief-routing";
import { GChatIntegrations } from "@/components/admin/gchat-integrations";
import { BriefRoutings } from "@/components/admin/brief-routings";
import { WhatsappAgent } from "@/components/admin/whatsapp-agent";
import { prisma } from "@/lib/prisma";
import { isValidProvider, providerConfigError } from "@/lib/ai";
import { AGENT_PROMPT_KEY } from "@/lib/whatsapp/prompt";
import { MessageSquare } from "lucide-react";

export const metadata = { title: "Integraciones del equipo" };

const KEYS = [
  "gchat_webhook_tickets",
  "gchat_webhook_tasks",
  "gchat_webhook_comments",
  "gchat_webhook_mentions",
];

export default async function IntegracionesPage() {
  await requireCan("ADMIN");

  // El prompt del agente se pide aparte y no dentro de KEYS: así el mapa que
  // recibe GChatIntegrations sigue siendo solo sus webhooks.
  const [settings, routings, staff, linkedUsers, agentSettings] = await Promise.all([
    getSettings(KEYS),
    listBriefRoutings(),
    listAssignableStaff(),
    prisma.user.count({ where: { whatsappPhone: { not: null }, isActive: true } }),
    getSettings([AGENT_PROMPT_KEY]),
  ]);

  const rawProvider = process.env.WHATSAPP_AI_PROVIDER;
  const aiProvider = isValidProvider(rawProvider) ? rawProvider : "gemini";

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";

  return (
    <div style={{ maxWidth: "48rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
          <MessageSquare style={{ width: "1.25rem", height: "1.25rem", color: "#6366f1" }} />
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Integraciones del equipo
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
          Conecta cada tipo de notificación a un canal de Google Chat distinto mediante webhooks, y decide
          quién recibe los briefs que llegan desde n8n. Aquí también vive el agente de WhatsApp.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <BriefRoutings
          routings={routings.map((r) => ({
            id: r.id,
            briefType: r.briefType,
            label: r.label,
            assignedToId: r.assignedToId,
            priority: r.priority,
            category: r.category,
            estimatedHours: r.estimatedHours,
            dueDays: r.dueDays,
            dueTime: r.dueTime,
            isActive: r.isActive,
            assignedTo: r.assignedTo,
          }))}
          staff={staff}
          webhookUrl={`${baseUrl}/api/integrations/brief`}
          tokenConfigured={Boolean(process.env.INTEGRATION_BRIEF_TOKEN?.trim())}
        />

        <WhatsappAgent
          webhookUrl={`${baseUrl}/api/integrations/whatsapp`}
          tokenConfigured={Boolean(process.env.INTEGRATION_WHATSAPP_TOKEN?.trim())}
          aiProvider={aiProvider}
          aiConfigured={providerConfigError(aiProvider) === null}
          linkedUsers={linkedUsers}
          savedPrompt={agentSettings[AGENT_PROMPT_KEY] ?? null}
        />

        <GChatIntegrations settings={settings} />
      </div>
    </div>
  );
}
