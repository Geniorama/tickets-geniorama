import Link from "next/link";
import { requireCan } from "@/lib/access/can";
import { getSettings } from "@/actions/settings.actions";
import { listBriefRoutings, listAssignableStaff } from "@/lib/brief-routing";
import { getOrgHooks } from "@/actions/hook.actions";
import { getApiKeys, getApiKeyCandidates } from "@/actions/api-key.actions";
import { getAgentSetup } from "@/lib/api/agent-setup";
import { GChatIntegrations } from "@/components/admin/gchat-integrations";
import { BriefRoutings } from "@/components/admin/brief-routings";
import { HooksManager } from "@/components/integrations/hooks-manager";
import { ApiKeys } from "@/components/integrations/api-keys";
import { AgentSetupPanel } from "@/components/integrations/agent-setup";
import { AgentChatSettings } from "@/components/integrations/agent-chat-settings";
import { getAgentChatConfig } from "@/lib/agent-chat";
import { IntegrationMap, IntegrationSection, type IntegrationCard } from "@/components/integrations/integration-map";
import { WhatsAppIntegration } from "@/components/admin/whatsapp-integration";
import { WhatsAppIcon, WHATSAPP_GREEN } from "@/components/ui/whatsapp-icon";
import { WHATSAPP_EVENTS, WHATSAPP_FROM_KEY, WHATSAPP_SETTING_KEYS } from "@/lib/whatsapp/config";
import { whatsappTokenConfigured } from "@/lib/whatsapp/send";
import { Plug, Webhook, KeyRound, BookOpen, Code2, Bot, FileInput, MessageSquare } from "lucide-react";

export const metadata = { title: "Integraciones del equipo" };

const GCHAT_KEYS = [
  "gchat_webhook_tickets",
  "gchat_webhook_tasks",
  "gchat_webhook_comments",
  "gchat_webhook_mentions",
];

const KEYS = [...GCHAT_KEYS, ...WHATSAPP_SETTING_KEYS];

const icon = (color: string) => ({ width: "1rem", height: "1rem", color, flexShrink: 0 });

const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "#6366f1",
  textDecoration: "none",
};

export default async function IntegracionesPage() {
  await requireCan("ADMIN");

  const [settings, routings, staff, hooks, apiKeys, candidates, agent, agentChat] = await Promise.all([
    getSettings(KEYS),
    listBriefRoutings(),
    listAssignableStaff(),
    getOrgHooks(),
    getApiKeys(),
    getApiKeyCandidates(),
    getAgentSetup(),
    getAgentChatConfig(),
  ]);

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const briefTokenConfigured = Boolean(process.env.INTEGRATION_BRIEF_TOKEN?.trim());
  const waTokenConfigured = whatsappTokenConfigured();

  // ── El estado de cada tarjeta ──
  const activeHooks = hooks.filter((h) => h.isActive).length;
  const activeKeys = apiKeys.filter((k) => k.isActive && !k.isExpired).length;
  const activeRoutings = routings.filter((r) => r.isActive).length;
  const waTemplates = WHATSAPP_EVENTS.filter((e) => settings[e.settingKey]).length;
  const waReady = waTokenConfigured && Boolean(settings[WHATSAPP_FROM_KEY]) && waTemplates > 0;
  const gchatChannels = GCHAT_KEYS.filter((k) => settings[k]).length;
  const agentClients = agent.companies.flatMap((c) => c.clients).filter((c) => c.phone && !c.duplicated).length;
  const agentReady = agent.companies.length > 0 && agent.keys.length > 0 && agent.secretConfigured;
  const agentChatClients = new Set(agent.companies.flatMap((c) => c.clients.map((u) => u.id))).size;

  const cards: IntegrationCard[] = [
    {
      id: "hooks",
      icon: <Webhook style={icon("#6366f1")} />,
      title: "Hooks",
      purpose: "Le cuentan a otra herramienta lo que pasa aquí, en el momento en que pasa.",
      example: "«Se abrió un ticket» → n8n avisa por Slack.",
      direction: "sale",
      status: activeHooks > 0 ? { tone: "ok", text: `${activeHooks} activo(s)` } : { tone: "off", text: "Ninguno" },
    },
    {
      id: "llaves",
      icon: <KeyRound style={icon("#0891b2")} />,
      title: "Llaves de API",
      purpose: "Dejan que otra herramienta lea o cree cosas aquí, en nombre de alguien.",
      example: "Un formulario de la web abre un ticket.",
      direction: "entra",
      status: activeKeys > 0 ? { tone: "ok", text: `${activeKeys} activa(s)` } : { tone: "off", text: "Ninguna" },
    },
    {
      id: "agente",
      icon: <Bot style={icon("#16a34a")} />,
      title: "Agente IA de atención",
      purpose: "Un asistente que atiende a los clientes por WhatsApp o en el chat de la plataforma, con sus propios datos.",
      example: "«¿Cuándo vence mi plan?», «mi sitio no carga».",
      direction: "conversa",
      status: agentReady
        ? { tone: "ok", text: agentChat.ready ? `Listo · WhatsApp y chat` : `Listo · ${agentClients} por WhatsApp` }
        : agent.companies.length > 0 || agent.keys.length > 0
          ? { tone: "warn", text: "Faltan pasos" }
          : { tone: "off", text: "Sin activar" },
    },
    {
      id: "briefs",
      icon: <FileInput style={icon("#7c3aed")} />,
      title: "Briefs a tickets",
      purpose: "Convierten cada brief que llega por n8n en un ticket ya asignado.",
      example: "Brief de «sitio web» → ticket para el equipo de desarrollo.",
      direction: "entra",
      status: activeRoutings > 0
        ? briefTokenConfigured ? { tone: "ok", text: `${activeRoutings} tipo(s)` } : { tone: "warn", text: "Falta el token" }
        : { tone: "off", text: "Ninguno" },
    },
    {
      id: "whatsapp",
      icon: <WhatsAppIcon style={icon(WHATSAPP_GREEN)} />,
      title: "Avisos por WhatsApp",
      purpose: "Mandan los avisos importantes al WhatsApp de quien lo active. Solo salen, no se responden.",
      example: "«Te asignaron un ticket».",
      direction: "sale",
      status: waReady
        ? { tone: "ok", text: `${waTemplates} tipo(s) de aviso` }
        : waTemplates > 0 || settings[WHATSAPP_FROM_KEY] ? { tone: "warn", text: "Incompleto" } : { tone: "off", text: "Sin configurar" },
    },
    {
      id: "gchat",
      icon: <MessageSquare style={icon("#0f9d58")} />,
      title: "Google Chat",
      purpose: "Publican la actividad del equipo en espacios de Google Chat.",
      example: "Cada ticket nuevo aparece en «Geniorama – Tickets».",
      direction: "sale",
      status: gchatChannels > 0 ? { tone: "ok", text: `${gchatChannels} de ${GCHAT_KEYS.length} canales` } : { tone: "off", text: "Sin configurar" },
    },
  ];

  return (
    <div style={{ maxWidth: "48rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
          <Plug style={{ width: "1.25rem", height: "1.25rem", color: "#6366f1" }} />
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Integraciones del equipo
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-text-muted)", lineHeight: 1.55 }}>
          Cada integración mueve información en una dirección: la plataforma <strong>avisa</strong> hacia
          fuera, algo de fuera <strong>escribe</strong> aquí, o se <strong>conversa</strong>. Elige por lo que
          quieres conseguir; los detalles de cada una están más abajo.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1.25rem", marginTop: "0.75rem" }}>
          <Link href="/admin/integraciones/api" style={linkStyle}>
            <BookOpen style={{ width: "0.875rem", height: "0.875rem" }} />
            Ver la guía de hooks y API
          </Link>
          <Link href="/admin/integraciones/api/referencia" style={linkStyle}>
            <Code2 style={{ width: "0.875rem", height: "0.875rem" }} />
            Referencia interactiva (Swagger)
          </Link>
        </div>
      </div>

      <div style={{ marginBottom: "2.5rem" }}>
        <IntegrationMap cards={cards} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
        <IntegrationSection
          id="hooks"
          icon={<Webhook style={icon("#6366f1")} />}
          title="Hooks de organización"
          intro={
            <>
              Cada vez que pasa algo —un ticket, una tarea, un proyecto, un comentario, el CRM— la plataforma
              manda un POST a la URL que pongas. Los proyectos privados quedan fuera: sus eventos solo llegan a
              los hooks del propio proyecto, que se configuran desde su ficha.
            </>
          }
          notFor="avisarle a una persona concreta. Para eso, cada quien tiene sus webhooks en Mis integraciones."
        >
          <HooksManager hooks={hooks} scope="ORG" />
        </IntegrationSection>

        <IntegrationSection
          id="llaves"
          icon={<KeyRound style={icon("#0891b2")} />}
          title="Llaves de API"
          intro={
            <>
              Dan entrada a <code>{baseUrl}/api/v1</code> para leer y escribir desde fuera. Cada llave actúa en
              nombre de un usuario y ve exactamente lo que esa persona vería. Los permisos deciden qué puede
              hacer.
            </>
          }
          notFor="conectar Claude, ChatGPT o Cursor: eso se hace sin llave, desde Mis integraciones → Asistentes de IA."
        >
          <ApiKeys keys={apiKeys} candidates={candidates} />
        </IntegrationSection>

        <IntegrationSection
          id="agente"
          icon={<Bot style={icon("#16a34a")} />}
          title="Agente IA de atención"
          intro={
            <>
              Un asistente que contesta a los clientes por WhatsApp o en el chat de la plataforma: el estado de sus tickets y proyectos, cuándo
              vence su plan, sus facturas, por qué no carga su sitio, y abre un ticket cuando no puede
              resolverlo. Vive en n8n; aquí se ve si la plataforma tiene su parte lista y quién podrá usarlo.
            </>
          }
          notFor="los avisos automáticos por WhatsApp (más abajo): esos salen con plantillas y no reciben respuestas."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <AgentSetupPanel setup={agent} />
            <AgentChatSettings
              url={agentChat.url}
              secretConfigured={agentChat.secretConfigured}
              keyId={agentChat.key?.id ?? null}
              keys={agentChat.keys}
              ready={agentChat.ready && agent.companies.length > 0}
              availableClients={agentChatClients}
            />
          </div>
        </IntegrationSection>

        <IntegrationSection
          id="briefs"
          icon={<FileInput style={icon("#7c3aed")} />}
          title="Briefs a tickets"
          intro="Cuando un cliente llena un brief, n8n lo manda aquí y se convierte en un ticket con responsable, prioridad y fecha según su tipo."
        >
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
            tokenConfigured={briefTokenConfigured}
          />
        </IntegrationSection>

        <IntegrationSection
          id="whatsapp"
          icon={<WhatsAppIcon style={icon(WHATSAPP_GREEN)} />}
          title="Avisos por WhatsApp (Zoho CPaaS)"
          intro={
            <>
              Los avisos importantes salen también por WhatsApp para quien lo active en <em>Mis integraciones</em>.
              WhatsApp solo permite mensajes con plantillas aprobadas por Meta: cada tipo de aviso necesita la suya.
              Un tipo sin clave de plantilla no se envía.
            </>
          }
          notFor="conversar con los clientes: Zoho CPaaS no recibe sus mensajes. Para eso está el agente IA."
        >
          <WhatsAppIntegration settings={settings} tokenConfigured={waTokenConfigured} />
        </IntegrationSection>

        <IntegrationSection
          id="gchat"
          icon={<MessageSquare style={icon("#0f9d58")} />}
          title="Google Chat"
          intro="Un espacio de Google Chat por tipo de actividad: tickets, tareas, comentarios y menciones. Pega la URL del webhook de cada espacio."
        >
          <GChatIntegrations settings={settings} />
        </IntegrationSection>
      </div>
    </div>
  );
}
