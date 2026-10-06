"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Send, Copy, Check } from "lucide-react";
import { WhatsAppIcon, WHATSAPP_GREEN } from "@/components/ui/whatsapp-icon";
import { saveSetting, deleteSetting } from "@/actions/settings.actions";
import { sendWhatsAppAdminTest } from "@/actions/whatsapp.actions";
import { WHATSAPP_EVENTS, WHATSAPP_FROM_KEY, type WhatsAppEvent } from "@/lib/whatsapp/config";

const WA_GREEN = "#16a34a";

const input: React.CSSProperties = {
  width: "100%",
  fontSize: "0.8125rem",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.375rem",
  border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-content-bg)",
  color: "var(--app-body-text)",
  outline: "none",
  minWidth: 0,
};

const smallButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  flexShrink: 0,
  fontSize: "0.8125rem",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.375rem",
  border: "1px solid var(--app-border)",
  background: "none",
  color: "var(--app-body-text)",
  cursor: "pointer",
};

type Result = { kind: "ok" | "error"; text: string } | null;

/** Un ajuste con su botón de guardar. Vacío = borrar el ajuste. */
function SettingField({
  settingKey, saved, placeholder, label,
}: {
  settingKey: string; saved: string; placeholder: string; label: string;
}) {
  const [value, setValue] = useState(saved);
  const [current, setCurrent] = useState(saved);
  const [result, setResult] = useState<Result>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setResult(null);
    const next = value.trim();
    startTransition(async () => {
      const res = next ? await saveSetting(settingKey, next) : await deleteSetting(settingKey);
      if (res.error) {
        setResult({ kind: "error", text: res.error });
        return;
      }
      setCurrent(next);
      setResult({ kind: "ok", text: next ? "Guardado" : "Borrado" });
    });
  }

  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label={label} style={input} />
        <button type="button" onClick={save} disabled={isPending || value.trim() === current} style={{ ...smallButton, opacity: isPending || value.trim() === current ? 0.5 : 1 }}>
          {isPending && <Loader2 style={{ width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" }} />}
          Guardar
        </button>
      </div>
      {result && (
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: result.kind === "error" ? "#dc2626" : "#15803d" }}>{result.text}</p>
      )}
    </div>
  );
}

function EventCard({ event, saved, testPhone }: { event: WhatsAppEvent; saved: string; testPhone: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const [isTesting, startTest] = useTransition();

  function copy() {
    void navigator.clipboard.writeText(event.templateBody).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function test() {
    setResult(null);
    if (!testPhone.trim()) {
      setResult({ kind: "error", text: "Escribe arriba un número para las pruebas." });
      return;
    }
    startTest(async () => {
      const res = await sendWhatsAppAdminTest(event.type, testPhone);
      setResult(
        "error" in res && res.error
          ? { kind: "error", text: res.error }
          : { kind: "ok", text: "Enviado. Si no llega, revisa el estado en los registros de WhatsApp de Zoho CPaaS." },
      );
    });
  }

  return (
    <div style={{ border: "1px solid var(--app-border)", borderRadius: "0.5rem", padding: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
          {saved
            ? <CheckCircle2 style={{ width: "0.875rem", height: "0.875rem", color: WA_GREEN, flexShrink: 0 }} />
            : <XCircle style={{ width: "0.875rem", height: "0.875rem", color: "var(--app-text-muted)", flexShrink: 0 }} />}
          <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)" }}>{event.label}</span>
          <span style={{ fontSize: "0.6875rem", color: "var(--app-text-muted)", border: "1px solid var(--app-border)", borderRadius: "9999px", padding: "0.05rem 0.5rem", whiteSpace: "nowrap" }}>
            {event.audience}
          </span>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ ...smallButton, border: "none", padding: "0.25rem", color: "var(--app-text-muted)" }} aria-expanded={open}>
          Plantilla
          {open ? <ChevronUp style={{ width: "0.875rem", height: "0.875rem" }} /> : <ChevronDown style={{ width: "0.875rem", height: "0.875rem" }} />}
        </button>
      </div>

      {open && (
        <div style={{ marginBottom: "0.625rem", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
          <p style={{ margin: "0 0 0.375rem" }}>
            Regístrala en Zoho CPaaS como <code>{event.templateName}</code>, categoría <strong>Utilidad</strong>, idioma
            español, con este texto y las variables <code>nombre</code>, <code>detalle</code> y <code>enlace</code>:
          </p>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.8125rem", color: "var(--app-body-text)", backgroundColor: "var(--app-content-bg)", border: "1px solid var(--app-border)", borderRadius: "0.375rem", padding: "0.5rem 0.75rem" }}>
            {event.templateBody}
          </pre>
          <button type="button" onClick={copy} style={{ ...smallButton, marginTop: "0.375rem", padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>
            {copied ? <Check style={{ width: "0.75rem", height: "0.75rem" }} /> : <Copy style={{ width: "0.75rem", height: "0.75rem" }} />}
            {copied ? "Copiado" : "Copiar texto"}
          </button>
        </div>
      )}

      <SettingField settingKey={event.settingKey} saved={saved} placeholder="Clave de la plantilla (template key) en Zoho CPaaS" label={`Clave de la plantilla de ${event.label}`} />

      {saved && (
        <div style={{ marginTop: "0.5rem" }}>
          <button type="button" onClick={test} disabled={isTesting} style={{ ...smallButton, padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}>
            {isTesting
              ? <Loader2 style={{ width: "0.75rem", height: "0.75rem", animation: "spin 1s linear infinite" }} />
              : <Send style={{ width: "0.75rem", height: "0.75rem" }} />}
            Enviar prueba
          </button>
          {result && (
            <p role={result.kind === "error" ? "alert" : "status"} style={{ margin: "0.375rem 0 0", fontSize: "0.75rem", color: result.kind === "error" ? "#dc2626" : "#15803d", wordBreak: "break-word" }}>
              {result.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * WhatsApp vía Zoho CPaaS: número emisor y una plantilla aprobada por cada tipo
 * de aviso. La clave de la API no se configura aquí: es un secreto y vive en el
 * entorno del servidor.
 */
export function WhatsAppIntegration({
  settings, tokenConfigured,
}: {
  settings: Record<string, string>; tokenConfigured: boolean;
}) {
  const [testPhone, setTestPhone] = useState("");

  return (
    <div>
      <div style={{ marginBottom: "0.875rem" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--app-body-text)" }}>
          <WhatsAppIcon style={{ width: "1rem", height: "1rem", color: WHATSAPP_GREEN }} />
          WhatsApp (Zoho CPaaS)
        </h2>
        <p style={{ margin: "0.375rem 0 0", fontSize: "0.8125rem", color: "var(--app-text-muted)", lineHeight: 1.55 }}>
          Los avisos importantes salen también por WhatsApp para quien lo active en <em>Mis integraciones</em>.
          WhatsApp solo permite mensajes con plantillas aprobadas por Meta: cada tipo de aviso necesita la suya.
          Un tipo sin clave de plantilla no se envía.
        </p>
      </div>

      <p
        style={{
          margin: "0 0 0.875rem",
          fontSize: "0.8125rem",
          borderRadius: "0.5rem",
          padding: "0.5rem 0.75rem",
          ...(tokenConfigured
            ? { color: "#166534", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0" }
            : { color: "#92400e", backgroundColor: "#fffbeb", border: "1px solid #fcd34d" }),
        }}
      >
        {tokenConfigured
          ? "La clave de Zoho CPaaS está configurada en el servidor."
          : "Falta la clave de Zoho CPaaS en el servidor (variable ZOHO_CPAAS_WHATSAPP_TOKEN). Sin ella no sale ningún mensaje."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, color: "var(--app-text-muted)", marginBottom: "0.25rem" }}>
            Número emisor (el de WhatsApp Business, con indicativo)
          </label>
          <SettingField settingKey={WHATSAPP_FROM_KEY} saved={settings[WHATSAPP_FROM_KEY] ?? ""} placeholder="+573001234567" label="Número emisor" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, color: "var(--app-text-muted)", marginBottom: "0.25rem" }}>
            Número para las pruebas (no se guarda)
          </label>
          <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="+573001234567" style={input} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {WHATSAPP_EVENTS.map((event) => (
          <EventCard key={event.type} event={event} saved={settings[event.settingKey] ?? ""} testPhone={testPhone} />
        ))}
      </div>
    </div>
  );
}
