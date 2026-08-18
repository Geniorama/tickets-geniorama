"use client";

import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";

/**
 * Los dos workflows de n8n, listos para llevárselos.
 *
 * Copiar gana a descargar: n8n acepta que pegues el JSON directamente sobre el
 * lienzo (Ctrl+V) y crea los nodos, sin pasar por «Import from File». La
 * descarga queda como alternativa para quien prefiera guardar el archivo.
 */

const ACCENT = "#25d366";

function ActionButtons({ json, filename }: { json: string; filename: string }) {
  const [copied, setCopied] = useState(false);

  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(json).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          });
        }}
        style={{
          padding: "0.4rem 0.75rem",
          borderRadius: "0.375rem",
          border: "none",
          backgroundColor: ACCENT,
          color: "#04321a",
          fontSize: "0.8125rem",
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
        }}
      >
        {copied
          ? <><Check style={{ width: "0.875rem", height: "0.875rem" }} /> Copiado — pégalo en n8n</>
          : <><Copy style={{ width: "0.875rem", height: "0.875rem" }} /> Copiar workflow</>}
      </button>

      <button
        type="button"
        onClick={download}
        style={{
          padding: "0.4rem 0.75rem",
          borderRadius: "0.375rem",
          border: "1px solid var(--app-border)",
          backgroundColor: "var(--app-card-bg)",
          color: "var(--app-text-muted)",
          fontSize: "0.8125rem",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
        }}
      >
        <Download style={{ width: "0.875rem", height: "0.875rem" }} /> Descargar .json
      </button>
    </div>
  );
}

export function WhatsappWorkflowCopy({
  workflow,
  workflowHttp,
}: {
  workflow: string | null;
  workflowHttp: string | null;
}) {
  if (!workflow && !workflowHttp) return null;

  return (
    <div
      style={{
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        backgroundColor: "var(--app-card-bg)",
        padding: "1rem 1.25rem",
        marginBottom: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {workflow && (
        <div>
          <p style={{ margin: "0 0 0.125rem", fontWeight: 600, fontSize: "0.875rem", color: "var(--app-body-text)" }}>
            Workflow recomendado — nodos nativos de WhatsApp
          </p>
          <p style={{ margin: "0 0 0.625rem", fontSize: "0.8125rem", color: "var(--app-text-muted)", lineHeight: 1.5 }}>
            5 nodos. El <em>WhatsApp Trigger</em> registra y verifica el webhook con Meta por su cuenta.
          </p>
          <ActionButtons json={workflow} filename="geniorama-whatsapp.workflow.json" />
        </div>
      )}

      {workflowHttp && (
        <div style={{ borderTop: workflow ? "1px solid var(--app-border)" : undefined, paddingTop: workflow ? "1rem" : undefined }}>
          <p style={{ margin: "0 0 0.125rem", fontWeight: 600, fontSize: "0.875rem", color: "var(--app-body-text)" }}>
            Alternativa sin nodos nativos
          </p>
          <p style={{ margin: "0 0 0.625rem", fontSize: "0.8125rem", color: "var(--app-text-muted)", lineHeight: 1.5 }}>
            8 nodos, montada con Webhook + HTTP Request. Úsala solo si no tienes el <em>App Secret</em> de
            la app de Meta, que es lo que pide la credencial OAuth del trigger.
          </p>
          <ActionButtons json={workflowHttp} filename="geniorama-whatsapp-http.workflow.json" />
        </div>
      )}
    </div>
  );
}
