"use client";

import { useState } from "react";
import {
  MessageCircle, ChevronDown, ChevronUp, Copy, Check, AlertTriangle, CheckCircle2,
} from "lucide-react";

const ACCENT = "#25d366"; // verde de WhatsApp

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      style={{
        padding: "0.25rem 0.5rem",
        borderRadius: "0.25rem",
        border: "1px solid var(--app-border)",
        backgroundColor: "var(--app-card-bg)",
        color: "var(--app-text-muted)",
        fontSize: "0.6875rem",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        flexShrink: 0,
      }}
    >
      {copied
        ? <><Check style={{ width: "0.75rem", height: "0.75rem" }} /> Copiado</>
        : <><Copy style={{ width: "0.75rem", height: "0.75rem" }} /> Copiar</>}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div style={{ position: "relative" }}>
      <pre
        style={{
          margin: 0,
          padding: "0.75rem 3.5rem 0.75rem 0.875rem",
          borderRadius: "0.5rem",
          border: "1px solid var(--app-border)",
          backgroundColor: "var(--app-input-bg, var(--app-card-bg))",
          fontSize: "0.75rem",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          color: "var(--app-body-text)",
          overflowX: "auto",
          lineHeight: 1.5,
        }}
      >
        {code}
      </pre>
      <div style={{ position: "absolute", top: "0.5rem", right: "0.5rem" }}>
        <CopyButton text={code} />
      </div>
    </div>
  );
}

const labelStyle = {
  margin: "0 0 0.375rem",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--app-body-text)",
} as const;

/**
 * Documentación operativa del agente de WhatsApp.
 *
 * No hay nada que configurar aquí: el agente no tiene reglas de enrutamiento
 * como los briefs. Lo que sí necesita el equipo es saber exactamente qué manda
 * n8n y qué recibe de vuelta, y ver de un vistazo si el token y el proveedor de
 * IA están puestos en el servidor — que es la causa del 90 % de los «el bot no
 * responde».
 */
export function WhatsappAgent({
  webhookUrl,
  tokenConfigured,
  aiProvider,
  aiConfigured,
  linkedUsers,
}: {
  webhookUrl: string;
  tokenConfigured: boolean;
  aiProvider: string;
  aiConfigured: boolean;
  linkedUsers: number;
}) {
  const [open, setOpen] = useState(false);

  const samplePayload = JSON.stringify(
    {
      from: "{{ $json.messages[0].from }}",
      text: "{{ $json.messages[0].text.body }}",
      messageId: "{{ $json.messages[0].id }}",
    },
    null,
    2,
  );

  const sampleResponse = JSON.stringify(
    { ok: true, reply: "Listo, tu ticket quedó abierto ✅ …", phone: "573001234567", linked: true },
    null,
    2,
  );

  return (
    <div>
      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.25rem" }}>
          <MessageCircle style={{ width: "1rem", height: "1rem", color: ACCENT }} />
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Agente de WhatsApp
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--app-text-muted)", lineHeight: 1.5 }}>
          Los clientes abren tickets, consultan su plan y comentan sus tickets escribiendo por WhatsApp.
          n8n recibe el mensaje, lo reenvía a la app y devuelve al cliente el texto que responde el agente.
        </p>
      </div>

      {/* Estado de la configuración */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
        <StatusRow
          ok={tokenConfigured}
          okText={<>Token <code>INTEGRATION_WHATSAPP_TOKEN</code> configurado.</>}
          badText={<>Falta <code>INTEGRATION_WHATSAPP_TOKEN</code> en el servidor: el endpoint responde 401 a todo.</>}
        />
        <StatusRow
          ok={aiConfigured}
          okText={<>Proveedor de IA: <strong>{aiProvider}</strong>.</>}
          badText={<>El proveedor <strong>{aiProvider}</strong> no tiene su API key configurada; el agente no podrá responder.</>}
        />
        <StatusRow
          ok={linkedUsers > 0}
          okText={<>{linkedUsers} usuario(s) con número de WhatsApp vinculado.</>}
          badText={<>Todavía no hay ningún usuario con WhatsApp vinculado. Pueden vincularse solos escribiéndole al bot, o puedes cargar el número en la ficha de cada usuario.</>}
        />
      </div>

      <div
        style={{
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.25rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            gap: "1rem",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)" }}>
            ¿Cómo conectar el workflow de n8n?
          </span>
          {open
            ? <ChevronUp style={{ width: "1rem", height: "1rem", color: "var(--app-text-muted)", flexShrink: 0 }} />
            : <ChevronDown style={{ width: "1rem", height: "1rem", color: "var(--app-text-muted)", flexShrink: 0 }} />}
        </button>

        {open && (
          <div style={{ padding: "1rem 1.25rem 1.25rem", borderTop: "1px solid var(--app-border)", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <p style={labelStyle}>
                1. Dispara el workflow con el webhook de WhatsApp (Meta Cloud API o tu BSP) y añade un nodo{" "}
                <em>HTTP Request</em> con método POST a esta URL:
              </p>
              <CodeBlock code={webhookUrl} />
            </div>

            <div>
              <p style={labelStyle}>2. Autenticación por cabecera:</p>
              <CodeBlock code={"Authorization: Bearer <INTEGRATION_WHATSAPP_TOKEN>"} />
            </div>

            <div>
              <p style={labelStyle}>
                3. Cuerpo del request (JSON). Solo <code>from</code> es obligatorio:
              </p>
              <CodeBlock code={samplePayload} />
            </div>

            <div>
              <p style={labelStyle}>
                4. La respuesta trae el texto listo para enviar. Conecta <code>reply</code> al nodo que
                manda el mensaje de vuelta a WhatsApp:
              </p>
              <CodeBlock code={sampleResponse} />
            </div>

            <div
              style={{
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                backgroundColor: "#eff6ff",
                border: "1px solid #bfdbfe",
                fontSize: "0.8125rem",
                color: "#1e40af",
                lineHeight: 1.5,
              }}
            >
              <strong>Ten en cuenta:</strong>
              <ul style={{ margin: "0.375rem 0 0", paddingLeft: "1.125rem" }}>
                <li>
                  Manda siempre <code>messageId</code>: con él, un reintento de n8n devuelve la misma
                  respuesta en vez de volver a correr el agente y crear el ticket dos veces.
                </li>
                <li>
                  Un número desconocido no ve ningún dato: el bot le pide su correo y le manda un código
                  de 6 dígitos para vincularse. También puedes registrar el número tú desde la ficha del
                  usuario.
                </li>
                <li>
                  El agente solo entiende texto. Si llega audio o imagen, transcríbelo en n8n o el bot
                  responderá pidiendo texto.
                </li>
                <li>
                  Crear un ticket siempre pasa por confirmación del cliente. Comentar y consultar no.
                </li>
                <li>
                  El agente nunca cierra tickets ni cambia estados, prioridades o fechas: eso sigue siendo
                  del equipo.
                </li>
                <li>
                  Un cliente sin plan activo puede consultar, pero no abrir tickets — igual que en la
                  plataforma.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusRow({
  ok,
  okText,
  badText,
}: {
  ok: boolean;
  okText: React.ReactNode;
  badText: React.ReactNode;
}) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: "0.8125rem",
        color: ok ? "var(--app-text-muted)" : "#b45309",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.375rem",
        lineHeight: 1.5,
      }}
    >
      {ok
        ? <CheckCircle2 style={{ width: "0.875rem", height: "0.875rem", flexShrink: 0, marginTop: "0.15rem", color: "#16a34a" }} />
        : <AlertTriangle style={{ width: "0.875rem", height: "0.875rem", flexShrink: 0, marginTop: "0.15rem" }} />}
      <span>{ok ? okText : badText}</span>
    </p>
  );
}
