"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Loader2, Send } from "lucide-react";
import { saveMyWhatsApp, sendMyWhatsAppTest, type MyWhatsApp } from "@/actions/whatsapp.actions";
import { COUNTRIES, splitPhone } from "@/lib/crm/phone";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-categories";

const WA_GREEN = "#16a34a";

const card: React.CSSProperties = {
  backgroundColor: "var(--app-card-bg)",
  border: "1px solid var(--app-border)",
  borderRadius: "0.75rem",
  padding: "1.25rem",
};

const input: React.CSSProperties = {
  fontSize: "0.8125rem",
  padding: "0.5rem 0.75rem",
  borderRadius: "0.375rem",
  border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-content-bg)",
  color: "var(--app-body-text)",
  outline: "none",
  minWidth: 0,
};

/**
 * Avisos por WhatsApp del propio usuario: su número, si quiere recibirlos y de
 * qué. Activarlo es el consentimiento que exige WhatsApp, así que solo lo hace
 * cada persona para sí misma.
 */
export function WhatsAppSettings({ initial }: { initial: MyWhatsApp }) {
  const start = splitPhone(initial.phone);
  const [dial, setDial] = useState(start.dial);
  const [number, setNumber] = useState(start.national);
  const [enabled, setEnabled] = useState(initial.enabled);
  // Sin nada elegido aún, se proponen todas: es lo que espera quien lo activa
  const [events, setEvents] = useState<string[]>(
    initial.events.length > 0 ? initial.events : NOTIFICATION_CATEGORIES.map((c) => c.key),
  );
  const [savedPhone, setSavedPhone] = useState(initial.phone);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isTesting, startTest] = useTransition();

  function toggleEvent(key: string) {
    setEvents((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function save() {
    setNotice(null);
    startTransition(async () => {
      const res = await saveMyWhatsApp({ dial, number, enabled, events });
      if ("error" in res && res.error) {
        setNotice({ kind: "error", text: res.error });
        return;
      }
      setSavedPhone(res.phone ?? null);
      setNotice({ kind: "ok", text: enabled ? "Guardado. Recibirás tus avisos por WhatsApp." : "Guardado. WhatsApp queda desactivado." });
    });
  }

  function test() {
    setNotice(null);
    startTest(async () => {
      const res = await sendMyWhatsAppTest();
      setNotice(
        "error" in res && res.error
          ? { kind: "error", text: res.error }
          : { kind: "ok", text: "Mensaje de prueba enviado. Debería llegarte en unos segundos." },
      );
    });
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.375rem" }}>
        <MessageCircle style={{ width: "1rem", height: "1rem", color: WA_GREEN }} />
        <h2 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)" }}>
          Avisos por WhatsApp
        </h2>
      </div>
      <p style={{ margin: "0 0 1rem", fontSize: "0.8125rem", color: "var(--app-text-muted)", lineHeight: 1.6 }}>
        Recibe en tu WhatsApp los avisos importantes: cuando te mencionan, te asignan algo o hay novedades en
        tus tickets. Solo te escribimos si lo activas, y puedes apagarlo cuando quieras.
      </p>

      {!initial.available && (
        <p
          style={{
            margin: "0 0 1rem",
            fontSize: "0.8125rem",
            color: "#92400e",
            backgroundColor: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: "0.5rem",
            padding: "0.5rem 0.75rem",
          }}
        >
          WhatsApp todavía no está disponible en la plataforma. Puedes dejar tu número guardado: empezará a
          funcionar en cuanto se active.
        </p>
      )}

      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 500, color: "var(--app-text-muted)", marginBottom: "0.25rem" }}>
        Tu número de WhatsApp
      </label>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <select value={dial} onChange={(e) => setDial(e.target.value)} style={{ ...input, flexShrink: 0 }} aria-label="Indicativo">
          {COUNTRIES.map((c) => (
            <option key={c.iso} value={c.dial}>{c.name} ({c.dial})</option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="300 123 4567"
          style={{ ...input, flex: 1 }}
        />
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => setEnabled((v) => !v)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "none",
          border: "none",
          padding: 0,
          marginBottom: "0.875rem",
          cursor: "pointer",
          fontSize: "0.875rem",
          fontWeight: 500,
          color: "var(--app-body-text)",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "relative",
            display: "inline-block",
            width: "2.125rem",
            height: "1.25rem",
            borderRadius: "9999px",
            backgroundColor: enabled ? "#22c55e" : "var(--app-border)",
            transition: "background-color 0.15s",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "0.125rem",
              left: enabled ? "1rem" : "0.125rem",
              width: "1rem",
              height: "1rem",
              borderRadius: "9999px",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
              transition: "left 0.15s",
            }}
          />
        </span>
        Quiero recibir avisos de Geniorama por WhatsApp
      </button>

      <fieldset disabled={!enabled} style={{ border: "none", margin: "0 0 1rem", padding: 0, opacity: enabled ? 1 : 0.5 }}>
        <legend style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--app-text-muted)", marginBottom: "0.375rem", padding: 0 }}>
          Qué quieres recibir
        </legend>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          {NOTIFICATION_CATEGORIES.map((c) => (
            <label key={c.key} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontSize: "0.8125rem", color: "var(--app-body-text)", cursor: enabled ? "pointer" : "default" }}>
              <input type="checkbox" checked={events.includes(c.key)} onChange={() => toggleEvent(c.key)} style={{ marginTop: "0.2rem" }} />
              <span>
                <strong style={{ fontWeight: 500 }}>{c.label}</strong>
                <span style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>{c.description}</span>
              </span>
            </label>
          ))}
        </div>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
          Por WhatsApp solo salen los avisos que piden tu atención (menciones, asignaciones y novedades de
          tickets), no todo lo que ves en la campana.
        </p>
      </fieldset>

      {notice && (
        <p role={notice.kind === "error" ? "alert" : "status"} style={{ margin: "0 0 0.75rem", fontSize: "0.8125rem", color: notice.kind === "error" ? "#dc2626" : "#15803d" }}>
          {notice.text}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "none",
            backgroundColor: "#fd1384",
            color: "#ffffff",
            cursor: isPending ? "wait" : "pointer",
            opacity: isPending ? 0.7 : 1,
          }}
        >
          {isPending && <Loader2 style={{ width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" }} />}
          Guardar
        </button>
        {initial.available && savedPhone && (
          <button
            type="button"
            onClick={test}
            disabled={isTesting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.8125rem",
              padding: "0.5rem 0.875rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--app-border)",
              background: "none",
              color: "var(--app-body-text)",
              cursor: isTesting ? "wait" : "pointer",
            }}
          >
            {isTesting
              ? <Loader2 style={{ width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" }} />
              : <Send style={{ width: "0.875rem", height: "0.875rem" }} />}
            Enviar mensaje de prueba
          </button>
        )}
      </div>
    </div>
  );
}
