import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { requireCan } from "@/lib/access/can";
import { ApiReference } from "@/components/integrations/api-reference";

/**
 * Referencia interactiva de la API.
 *
 * La guía de al lado (`../`) explica el porqué y da el paso a paso; esta
 * pantalla es el otro tipo de documentación: el contrato campo por campo, con
 * «Try it out» para probar contra esta misma instalación sin salir del panel.
 */

export const metadata = { title: "Referencia de la API" };

export default async function ApiReferencePage() {
  await requireCan("ADMIN");

  return (
    <div style={{ maxWidth: "64rem" }}>
      <Link
        href="/admin/integraciones/api"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.375rem",
          fontSize: "0.8125rem",
          color: "var(--app-text-muted)",
          textDecoration: "none",
          marginBottom: "1rem",
        }}
      >
        <ArrowLeft style={{ width: "0.875rem", height: "0.875rem" }} />
        Guía de hooks y API
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.25rem",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-text-muted)", lineHeight: 1.55, flex: "1 1 24rem" }}>
          Pulsa <strong>Authorize</strong> y pega el token de una llave para probar cualquier endpoint
          desde aquí con <em>Try it out</em>. Las llamadas van contra <strong>esta</strong> instalación,
          así que lo que crees se crea de verdad.
        </p>
        <a
          href="/api/v1/openapi.json"
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "#6366f1",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: "0.375rem",
            padding: "0.4rem 0.75rem",
            textDecoration: "none",
            flexShrink: 0,
          }}
        >
          <Download style={{ width: "0.875rem", height: "0.875rem" }} />
          openapi.json
        </a>
      </div>

      <ApiReference specUrl="/api/v1/openapi.json" />
    </div>
  );
}
