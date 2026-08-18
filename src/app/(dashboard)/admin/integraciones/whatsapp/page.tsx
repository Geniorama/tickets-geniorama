import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { requireCan } from "@/lib/access/can";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { WhatsappWorkflowCopy } from "@/components/admin/whatsapp-workflow-copy";

/**
 * Guía de conexión del agente de WhatsApp con n8n.
 *
 * El contenido no se duplica aquí: se lee del mismo `docs/` que versiona el
 * repositorio, para que la guía que ve el equipo en la plataforma y la que lee
 * quien toca el código sean literalmente el mismo archivo. `next.config.ts`
 * mete `docs/**` en el bundle standalone para que exista también en producción.
 */

export const metadata = { title: "Agente de WhatsApp — conectar n8n" };

const DOCS_DIR = path.join(process.cwd(), "docs");

async function readDoc(relativePath: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(DOCS_DIR, relativePath), "utf8");
  } catch {
    // Falta el archivo (bundle incompleto): la página sigue siendo útil con lo
    // que sí cargó, en vez de devolver un 500.
    return null;
  }
}

export default async function WhatsappGuidePage() {
  await requireCan("ADMIN");

  const [guide, workflow, workflowHttp] = await Promise.all([
    readDoc("n8n-whatsapp-meta-cloud.md"),
    readDoc(path.join("n8n", "whatsapp-meta-cloud.workflow.json")),
    readDoc(path.join("n8n", "whatsapp-meta-cloud-http.workflow.json")),
  ]);

  return (
    <div style={{ maxWidth: "48rem" }}>
      <Link
        href="/admin/integraciones"
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
        Integraciones del equipo
      </Link>

      <WhatsappWorkflowCopy workflow={workflow} workflowHttp={workflowHttp} />

      {guide ? (
        <MarkdownRenderer content={guide} />
      ) : (
        <p
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
            padding: "0.875rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #fcd34d",
            backgroundColor: "#fffbeb",
            color: "#92400e",
            fontSize: "0.8125rem",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          <AlertTriangle style={{ width: "1rem", height: "1rem", flexShrink: 0, marginTop: "0.1rem" }} />
          <span>
            No encontré la guía en el servidor (<code>docs/n8n-whatsapp-meta-cloud.md</code>). Está en el
            repositorio; si falta aquí, el bundle se desplegó sin la carpeta <code>docs/</code>.
          </span>
        </p>
      )}
    </div>
  );
}
