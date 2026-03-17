import { requireRole } from "@/lib/auth-helpers";
import { getSettings } from "@/actions/settings.actions";
import { GChatIntegrations } from "@/components/admin/gchat-integrations";
import { MessageSquare } from "lucide-react";

const KEYS = [
  "gchat_webhook_tickets",
  "gchat_webhook_tasks",
  "gchat_webhook_comments",
  "gchat_webhook_mentions",
];

export default async function IntegracionesPage() {
  await requireRole(["ADMINISTRADOR"]);
  const settings = await getSettings(KEYS);

  return (
    <div style={{ maxWidth: "48rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
          <MessageSquare style={{ width: "1.25rem", height: "1.25rem", color: "#6366f1" }} />
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Integraciones
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
          Conecta cada tipo de notificación a un canal de Google Chat distinto mediante webhooks.
        </p>
      </div>

      <GChatIntegrations settings={settings} />
    </div>
  );
}
