import { getRequiredSession } from "@/lib/auth-helpers";
import { getMyWebhooks } from "@/actions/user-webhook.actions";
import { UserWebhooks } from "@/components/integrations/user-webhooks";
import { Plug } from "lucide-react";

export const metadata = { title: "Integraciones" };

export default async function IntegracionesPage() {
  await getRequiredSession();
  const webhooks = await getMyWebhooks();

  return (
    <div style={{ maxWidth: "48rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
          <Plug style={{ width: "1.25rem", height: "1.25rem", color: "#fd1384" }} />
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Integraciones
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
          Conecta <strong>tus</strong> notificaciones con otras apps mediante webhooks. Cada webhook recibe
          únicamente las notificaciones dirigidas a ti, en las categorías que elijas.
        </p>
      </div>

      <UserWebhooks webhooks={webhooks} />
    </div>
  );
}
