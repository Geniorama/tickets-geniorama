import { getRequiredSession } from "@/lib/auth-helpers";
import { getMyWebhooks } from "@/actions/user-webhook.actions";
import { getMyConnectedApps } from "@/actions/oauth.actions";
import { UserWebhooks } from "@/components/integrations/user-webhooks";
import { ConnectedApps } from "@/components/integrations/connected-apps";
import { WhatsAppSettings } from "@/components/integrations/whatsapp-settings";
import { getMyWhatsApp } from "@/actions/whatsapp.actions";
import { mcpResourceUrl } from "@/lib/oauth/config";
import { Plug } from "lucide-react";

export const metadata = { title: "Mis integraciones" };

export default async function IntegracionesPage() {
  await getRequiredSession();
  const [webhooks, apps, whatsapp] = await Promise.all([getMyWebhooks(), getMyConnectedApps(), getMyWhatsApp()]);

  return (
    <div style={{ maxWidth: "48rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
          <Plug style={{ width: "1.25rem", height: "1.25rem", color: "#fd1384" }} />
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Mis integraciones
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
          Conecta tu cuenta con asistentes de IA y <strong>tus</strong> notificaciones con otras apps mediante
          webhooks. Cada webhook recibe únicamente las notificaciones dirigidas a ti, en las categorías que elijas.
        </p>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <ConnectedApps mcpUrl={mcpResourceUrl()} apps={apps} />
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <WhatsAppSettings initial={whatsapp} />
      </div>

      <UserWebhooks webhooks={webhooks} />
    </div>
  );
}
