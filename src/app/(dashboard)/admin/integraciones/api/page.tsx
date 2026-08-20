import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, Code2 } from "lucide-react";
import { requireCan } from "@/lib/access/can";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

/**
 * Guía de hooks y API.
 *
 * El contenido no se duplica aquí: se lee del mismo `docs/` que versiona el
 * repositorio, para que la guía que ve el equipo en la plataforma y la que lee
 * quien toca el código sean literalmente el mismo archivo. `next.config.ts`
 * mete `docs/**` en el bundle standalone para que exista también en producción.
 */

export const metadata = { title: "Hooks y API — guía de integración" };

const DOCS_DIR = path.join(process.cwd(), "docs");

async function readDoc(relativePath: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(DOCS_DIR, relativePath), "utf8");
  } catch {
    // Falta el archivo (bundle incompleto): la página lo dice en vez de
    // devolver un 500.
    return null;
  }
}

export default async function ApiGuidePage() {
  await requireCan("ADMIN");

  const guide = await readDoc("hooks-y-api.md");

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

      <Link
        href="/admin/integraciones/api/referencia"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          padding: "0.875rem 1rem",
          marginBottom: "1.5rem",
          borderRadius: "0.5rem",
          border: "1px solid rgba(99,102,241,0.3)",
          backgroundColor: "rgba(99,102,241,0.08)",
          textDecoration: "none",
        }}
      >
        <Code2 style={{ width: "1rem", height: "1rem", color: "#6366f1", flexShrink: 0 }} />
        <span style={{ fontSize: "0.8125rem", color: "var(--app-body-text)", lineHeight: 1.5 }}>
          <strong style={{ color: "#6366f1" }}>Referencia interactiva</strong> — el contrato campo por
          campo, con Swagger UI y «Try it out» para probar sin salir del panel.
        </span>
      </Link>

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
            No encontré la guía en el servidor (<code>docs/hooks-y-api.md</code>). Está en el
            repositorio; si falta aquí, el bundle se desplegó sin la carpeta <code>docs/</code>.
          </span>
        </p>
      )}
    </div>
  );
}
