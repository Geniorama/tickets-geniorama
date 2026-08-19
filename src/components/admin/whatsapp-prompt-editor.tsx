"use client";

import { useState, useTransition } from "react";
import {
  Sparkles, ChevronDown, ChevronUp, Save, RotateCcw, Loader2,
  CheckCircle2, XCircle, AlertTriangle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { saveAgentPrompt, resetAgentPrompt } from "@/actions/whatsapp-agent.actions";
import { DEFAULT_AGENT_PROMPT, AGENT_PROMPT_MAX_CHARS } from "@/lib/whatsapp/prompt";

/**
 * Editor de las instrucciones del agente.
 *
 * Se edita el prompt completo, reglas duras incluidas. Es deliberado, pero por
 * eso el aviso de arriba no se puede plegar: quien reescriba los bloques QUÉ
 * SABES o REGLAS DURAS está cambiando lo que el agente puede afirmarle a un
 * cliente, no el tono.
 */

const ACCENT = "#25d366";

export function WhatsappPromptEditor({ saved }: { saved: string | null }) {
  const isCustom = Boolean(saved?.trim());
  const initial = saved?.trim() || DEFAULT_AGENT_PROMPT;

  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [isPending, startTransition] = useTransition();

  const trimmed = value.trim();
  const dirty = trimmed !== initial.trim();
  const tooLong = trimmed.length > AGENT_PROMPT_MAX_CHARS;
  const matchesDefault = trimmed === DEFAULT_AGENT_PROMPT.trim();

  function save() {
    setStatus("idle");
    startTransition(async () => {
      const res = await saveAgentPrompt(value);
      if (res.error) {
        setErrorMsg(res.error);
        setStatus("error");
        return;
      }
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2500);
    });
  }

  function reset() {
    setStatus("idle");
    startTransition(async () => {
      const res = await resetAgentPrompt();
      setConfirmReset(false);
      if (res.error) {
        setErrorMsg(res.error);
        setStatus("error");
        return;
      }
      setValue(DEFAULT_AGENT_PROMPT);
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 2500);
    });
  }

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        overflow: "hidden",
        marginBottom: "0.75rem",
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
        <span style={{ display: "flex", alignItems: "center", gap: "0.625rem", minWidth: 0 }}>
          <Sparkles style={{ width: "1rem", height: "1rem", color: ACCENT, flexShrink: 0 }} />
          <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--app-body-text)" }}>
            Instrucciones del agente
          </span>
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              padding: "0.1rem 0.45rem",
              borderRadius: "999px",
              whiteSpace: "nowrap",
              backgroundColor: isCustom ? `${ACCENT}22` : "var(--app-input-bg, var(--app-card-bg))",
              border: `1px solid ${isCustom ? `${ACCENT}66` : "var(--app-border)"}`,
              color: isCustom ? "var(--app-body-text)" : "var(--app-text-muted)",
            }}
          >
            {isCustom ? "Personalizadas" : "Texto original"}
          </span>
        </span>
        {open
          ? <ChevronUp style={{ width: "1rem", height: "1rem", color: "var(--app-text-muted)", flexShrink: 0 }} />
          : <ChevronDown style={{ width: "1rem", height: "1rem", color: "var(--app-text-muted)", flexShrink: 0 }} />}
      </button>

      {open && (
        <div style={{ padding: "0 1.25rem 1.25rem", borderTop: "1px solid var(--app-border)", paddingTop: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              backgroundColor: "#fffbeb",
              border: "1px solid #fcd34d",
              color: "#92400e",
              fontSize: "0.8125rem",
              lineHeight: 1.5,
              marginBottom: "0.875rem",
            }}
          >
            <AlertTriangle style={{ width: "1rem", height: "1rem", flexShrink: 0, marginTop: "0.1rem" }} />
            <span>
              Esto es lo que el modelo lee antes de cada mensaje a un cliente. Los bloques{" "}
              <strong>QUÉ SABES</strong> y <strong>REGLAS DURAS</strong> no son estilo: describen cómo se
              comporta el código. Si borras «nunca afirmes que creaste algo si no llamaste a la función»,
              el agente puede decirle a un cliente que le abrió un ticket que no existe.
            </span>
          </div>

          <textarea
            value={value}
            onChange={(e) => { setValue(e.target.value); setStatus("idle"); }}
            spellCheck={false}
            rows={22}
            style={{
              width: "100%",
              padding: "0.75rem 0.875rem",
              borderRadius: "0.5rem",
              border: `1px solid ${tooLong ? "#dc2626" : "var(--app-border)"}`,
              backgroundColor: "var(--app-input-bg, var(--app-card-bg))",
              color: "var(--app-body-text)",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "0.75rem",
              lineHeight: 1.6,
              resize: "vertical",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.625rem" }}>
            <span style={{ fontSize: "0.75rem", color: tooLong ? "#dc2626" : "var(--app-text-muted)" }}>
              {trimmed.length.toLocaleString("es")} / {AGENT_PROMPT_MAX_CHARS.toLocaleString("es")} caracteres
            </span>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                disabled={isPending || (!isCustom && matchesDefault)}
                style={{
                  padding: "0.45rem 0.8rem",
                  borderRadius: "0.375rem",
                  border: "1px solid var(--app-border)",
                  backgroundColor: "var(--app-card-bg)",
                  color: "var(--app-text-muted)",
                  fontSize: "0.8125rem",
                  cursor: isPending || (!isCustom && matchesDefault) ? "not-allowed" : "pointer",
                  opacity: isPending || (!isCustom && matchesDefault) ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                <RotateCcw style={{ width: "0.875rem", height: "0.875rem" }} />
                Restaurar el original
              </button>

              <button
                type="button"
                onClick={save}
                disabled={isPending || !dirty || !trimmed || tooLong}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "0.375rem",
                  border: "none",
                  backgroundColor: ACCENT,
                  color: "#04321a",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: isPending || !dirty || !trimmed || tooLong ? "not-allowed" : "pointer",
                  opacity: isPending || !dirty || !trimmed || tooLong ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                }}
              >
                {isPending
                  ? <><Loader2 style={{ width: "0.875rem", height: "0.875rem" }} /> Guardando…</>
                  : <><Save style={{ width: "0.875rem", height: "0.875rem" }} /> Guardar</>}
              </button>
            </div>
          </div>

          {status === "ok" && (
            <p style={{ margin: "0.625rem 0 0", fontSize: "0.8125rem", color: "#16a34a", display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <CheckCircle2 style={{ width: "0.875rem", height: "0.875rem" }} />
              Guardado. Se aplica en el siguiente mensaje que responda el agente.
            </p>
          )}
          {status === "error" && (
            <p style={{ margin: "0.625rem 0 0", fontSize: "0.8125rem", color: "#dc2626", display: "flex", alignItems: "flex-start", gap: "0.375rem" }}>
              <XCircle style={{ width: "0.875rem", height: "0.875rem", flexShrink: 0, marginTop: "0.1rem" }} />
              {errorMsg}
            </p>
          )}

          <p style={{ margin: "0.75rem 0 0", fontSize: "0.75rem", color: "var(--app-text-muted)", lineHeight: 1.5 }}>
            No se edita desde aquí lo que depende de cada conversación: el aviso de «este cliente no tiene
            plan activo» y el de la propuesta de ticket pendiente de confirmar los añade el código al
            final, junto con las descripciones de las tres herramientas.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="¿Restaurar las instrucciones originales?"
        message="Se descarta lo que tengas guardado y el agente vuelve al texto de fábrica. No se puede deshacer."
        confirmLabel="Restaurar"
        variant="danger"
        isPending={isPending}
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
