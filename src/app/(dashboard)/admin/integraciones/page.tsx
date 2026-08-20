import Link from "next/link";
import { requireCan } from "@/lib/access/can";
import { getSettings } from "@/actions/settings.actions";
import { listBriefRoutings, listAssignableStaff } from "@/lib/brief-routing";
import { getOrgHooks } from "@/actions/hook.actions";
import { getApiKeys, getApiKeyCandidates } from "@/actions/api-key.actions";
import { GChatIntegrations } from "@/components/admin/gchat-integrations";
import { BriefRoutings } from "@/components/admin/brief-routings";
import { HooksManager } from "@/components/integrations/hooks-manager";
import { ApiKeys } from "@/components/integrations/api-keys";
import { Plug, Webhook, KeyRound, BookOpen, Code2 } from "lucide-react";

export const metadata = { title: "Integraciones del equipo" };

const KEYS = [
  "gchat_webhook_tickets",
  "gchat_webhook_tasks",
  "gchat_webhook_comments",
  "gchat_webhook_mentions",
];

function SectionHeader({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "0.875rem" }}>
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          margin: 0,
          fontSize: "1rem",
          fontWeight: 700,
          color: "var(--app-body-text)",
        }}
      >
        {icon}
        {title}
      </h2>
      <p style={{ margin: "0.375rem 0 0", fontSize: "0.8125rem", color: "var(--app-text-muted)", lineHeight: 1.55 }}>
        {children}
      </p>
    </div>
  );
}

export default async function IntegracionesPage() {
  await requireCan("ADMIN");

  const [settings, routings, staff, hooks, apiKeys, candidates] = await Promise.all([
    getSettings(KEYS),
    listBriefRoutings(),
    listAssignableStaff(),
    getOrgHooks(),
    getApiKeys(),
    getApiKeyCandidates(),
  ]);

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";

  return (
    <div style={{ maxWidth: "48rem" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
          <Plug style={{ width: "1.25rem", height: "1.25rem", color: "#6366f1" }} />
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Integraciones del equipo
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-text-muted)", lineHeight: 1.55 }}>
          La plataforma no habla con ningún canal por su cuenta: <strong>cuenta lo que pasa</strong> por
          hooks y <strong>deja escribir</strong> por su API. Lo que se haga con eso —WhatsApp, Slack,
          Telegram, un CRM— se arma fuera, donde se pueda cambiar sin tocar el producto.
        </p>
        <Link
          href="/admin/integraciones/api"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            marginTop: "0.75rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "#6366f1",
            textDecoration: "none",
          }}
        >
          <BookOpen style={{ width: "0.875rem", height: "0.875rem" }} />
          Ver la guía de hooks y API
        </Link>
        <Link
          href="/admin/integraciones/api/referencia"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            marginTop: "0.75rem",
            marginLeft: "1.25rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "#6366f1",
            textDecoration: "none",
          }}
        >
          <Code2 style={{ width: "0.875rem", height: "0.875rem" }} />
          Referencia interactiva (Swagger)
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
        <section>
          <SectionHeader
            icon={<Webhook style={{ width: "1rem", height: "1rem", color: "#6366f1" }} />}
            title="Hooks de organización"
          >
            Reciben lo que ocurre en toda la plataforma: tickets, tareas, proyectos y comentarios.
            Los proyectos privados quedan fuera — sus eventos solo llegan a los hooks del propio
            proyecto, que se configuran desde su ficha.
          </SectionHeader>
          <HooksManager hooks={hooks} scope="ORG" />
        </section>

        <section>
          <SectionHeader
            icon={<KeyRound style={{ width: "1rem", height: "1rem", color: "#0891b2" }} />}
            title="Llaves de API"
          >
            Dan entrada a <code>{baseUrl}/api/v1</code> para leer y escribir desde fuera. Cada llave
            actúa en nombre de un usuario y ve exactamente lo que esa persona vería.
          </SectionHeader>
          <ApiKeys keys={apiKeys} candidates={candidates} />
        </section>

        <section>
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
        </section>

        <section>
          <GChatIntegrations settings={settings} />
        </section>
      </div>
    </div>
  );
}
