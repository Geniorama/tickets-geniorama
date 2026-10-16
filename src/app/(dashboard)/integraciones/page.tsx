import { getRequiredSession } from "@/lib/auth-helpers";
import { getMyWebhooks } from "@/actions/user-webhook.actions";
import { getMyConnectedApps } from "@/actions/oauth.actions";
import { UserWebhooks } from "@/components/integrations/user-webhooks";
import { ConnectedApps } from "@/components/integrations/connected-apps";
import { WhatsAppSettings } from "@/components/integrations/whatsapp-settings";
import { IntegrationMap, type IntegrationCard } from "@/components/integrations/integration-map";
import { WhatsAppIcon, WHATSAPP_GREEN } from "@/components/ui/whatsapp-icon";
import { getMyWhatsApp } from "@/actions/whatsapp.actions";
import { clientHasPlanFeature } from "@/lib/plans.server";
import { mcpResourceUrl } from "@/lib/oauth/config";
import { Plug, Bot, Webhook, MessageCircle } from "lucide-react";

export const metadata = { title: "Mis integraciones" };

const icon = (color: string) => ({ width: "1rem", height: "1rem", color, flexShrink: 0 });

export default async function IntegracionesPage() {
  const session = await getRequiredSession();
  const [webhooks, apps, whatsapp, agentEnabled] = await Promise.all([
    getMyWebhooks(),
    getMyConnectedApps(),
    getMyWhatsApp(),
    session.user.role === "CLIENTE" ? clientHasPlanFeature(session.user.id, "aiAgent") : Promise.resolve(false),
  ]);

  const activeWebhooks = webhooks.filter((w) => w.isActive).length;

  const cards: IntegrationCard[] = [
    {
      id: "asistentes",
      icon: <Bot style={icon("#fd1384")} />,
      title: "Asistentes de IA",
      purpose: "Conecta Claude, ChatGPT o Cursor a tu cuenta para consultar y trabajar desde ahí.",
      example: "«Resume mis tickets abiertos».",
      direction: "entra",
      status: apps.length > 0 ? { tone: "ok", text: `${apps.length} conectado(s)` } : { tone: "off", text: "Ninguno" },
    },
    ...(agentEnabled
      ? [{
          id: "whatsapp",
          icon: <MessageCircle style={icon("#16a34a")} />,
          title: "Asistente por WhatsApp",
          purpose: "Escríbele al asistente de Geniorama y te responde con tus datos.",
          example: "«¿Cuántas horas me quedan?».",
          direction: "conversa" as const,
          status: whatsapp.phone
            ? { tone: "ok" as const, text: "Incluido en tu plan" }
            : { tone: "warn" as const, text: "Falta tu número" },
        }]
      : []),
    {
      id: "whatsapp",
      icon: <WhatsAppIcon style={icon(WHATSAPP_GREEN)} />,
      title: "Avisos por WhatsApp",
      purpose: "Te llegan al WhatsApp los avisos que piden tu atención.",
      example: "«Te mencionaron en un ticket».",
      direction: "sale",
      status: whatsapp.enabled && whatsapp.phone ? { tone: "ok", text: "Activos" } : { tone: "off", text: "Apagados" },
    },
    {
      id: "webhooks",
      icon: <Webhook style={icon("#6366f1")} />,
      title: "Webhooks",
      purpose: "Mandan tus notificaciones a otra app (Slack, Zapier, n8n…).",
      example: "Tus menciones, en un canal de Slack.",
      direction: "sale",
      status: activeWebhooks > 0 ? { tone: "ok", text: `${activeWebhooks} activo(s)` } : { tone: "off", text: "Ninguno" },
    },
  ];

  return (
    <div style={{ maxWidth: "48rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
          <Plug style={{ width: "1.25rem", height: "1.25rem", color: "#fd1384" }} />
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Mis integraciones
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-text-muted)", lineHeight: 1.55 }}>
          Conecta tu cuenta con otras herramientas. Todo lo de aquí es <strong>solo tuyo</strong>: ves y recibes
          únicamente lo que te corresponde, y puedes desconectarlo cuando quieras.
        </p>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <IntegrationMap cards={cards} />
      </div>

      <div id="asistentes" style={{ marginBottom: "1.5rem", scrollMarginTop: "1rem" }}>
        <ConnectedApps mcpUrl={mcpResourceUrl()} apps={apps} />
      </div>

      <div id="whatsapp" style={{ marginBottom: "1.5rem", scrollMarginTop: "1rem" }}>
        <WhatsAppSettings initial={whatsapp} agentEnabled={agentEnabled} />
      </div>

      <div id="webhooks" style={{ scrollMarginTop: "1rem" }}>
        <UserWebhooks webhooks={webhooks} />
      </div>
    </div>
  );
}
