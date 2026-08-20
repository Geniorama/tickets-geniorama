"use client";

/**
 * Swagger UI sobre el spec que sirve la propia instalación.
 *
 * Se monta desde `public/swagger-ui/` —los archivos que copia
 * `scripts/copy-swagger-ui.mjs`— y no importando `swagger-ui-react`. El paquete
 * de React arrastra `@swagger-api/apidom-*`, y al pasar por Turbopack pierde
 * `OpenApi3_1Element.refract`: la lista de endpoints se pinta, pero ninguna
 * operación llega a abrirse nunca. El bundle oficial ya viene compilado por el
 * propio proyecto de Swagger, así que no depende de nuestro empaquetador.
 *
 * Los archivos son locales, no de un CDN: la pantalla tiene que funcionar en una
 * red cerrada y sin pedirle nada a un tercero.
 *
 * El `url` apunta a `/api/v1/openapi.json` en vez de incrustar el documento: así
 * la referencia no puede quedarse desfasada respecto a lo que el servidor dice
 * de sí mismo, y ese mismo enlace sirve para importar en Postman.
 */

import { useEffect, useRef, useState } from "react";

const BASE = "/swagger-ui";

type SwaggerUIBundle = (options: Record<string, unknown>) => unknown;

declare global {
  interface Window {
    SwaggerUIBundle?: SwaggerUIBundle;
  }
}

/** Carga un recurso una sola vez, aunque el componente se vuelva a montar. */
function loadOnce(id: string, create: () => HTMLElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(id)), { once: true });
      }
      return;
    }

    const element = create();
    element.id = id;
    element.addEventListener("load", () => {
      element.dataset.loaded = "true";
      resolve();
    }, { once: true });
    element.addEventListener("error", () => reject(new Error(id)), { once: true });
    document.head.appendChild(element);
  });
}

export function ApiReference({ specUrl }: { specUrl: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      try {
        await loadOnce("swagger-ui-css", () => {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = `${BASE}/swagger-ui.css`;
          return link;
        });

        await loadOnce("swagger-ui-js", () => {
          const script = document.createElement("script");
          script.src = `${BASE}/swagger-ui-bundle.js`;
          script.async = true;
          return script;
        });

        if (cancelled || !container.current) return;

        const bundle = window.SwaggerUIBundle;
        if (!bundle) throw new Error("SwaggerUIBundle no quedó disponible");

        bundle({
          url: specUrl,
          domNode: container.current,
          docExpansion: "list",
          defaultModelsExpandDepth: -1,
          persistAuthorization: true,
          tryItOutEnabled: true,
        });

        setReady(true);
      } catch {
        if (!cancelled) {
          setError(
            "No se pudieron cargar los archivos de Swagger UI. Se copian desde node_modules " +
              "al arrancar (`npm run dev` o `npm run build`); si faltan, el bundle se desplegó sin ellos.",
          );
        }
      }
    }

    void mount();
    return () => {
      cancelled = true;
    };
  }, [specUrl]);

  if (error) {
    return (
      <p
        style={{
          padding: "0.875rem 1rem",
          borderRadius: "0.5rem",
          border: "1px solid #fcd34d",
          backgroundColor: "#fffbeb",
          color: "#92400e",
          fontSize: "0.8125rem",
          lineHeight: 1.5,
        }}
      >
        {error}
      </p>
    );
  }

  return (
    <div className="swagger-host">
      {!ready && (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>Cargando la referencia…</p>
      )}
      <div ref={container} />
      <style dangerouslySetInnerHTML={{ __html: OVERRIDES }} />
    </div>
  );
}

/*
 * Swagger UI trae su propia hoja de estilos, pensada para ocupar una página
 * entera y con colores fijos. Estos retoques son los mínimos para que encaje
 * dentro del panel y no cante en el tema oscuro; el resto de su interfaz se deja
 * tal cual, que es justamente lo que la hace reconocible para quien ya la ha
 * usado.
 */
const OVERRIDES = `
.swagger-host .swagger-ui { font-family: inherit; }
.swagger-host .swagger-ui .topbar { display: none; }
.swagger-host .swagger-ui .info,
.swagger-host .swagger-ui .scheme-container {
  margin: 0 0 1.5rem;
  padding: 0;
  background: transparent;
  box-shadow: none;
}
.swagger-host .swagger-ui .info .title small.version-stamp { background-color: #6366f1; }

@media (prefers-color-scheme: dark) {
  .swagger-host .swagger-ui,
  .swagger-host .swagger-ui .info .title,
  .swagger-host .swagger-ui .info li,
  .swagger-host .swagger-ui .info p,
  .swagger-host .swagger-ui .info table,
  .swagger-host .swagger-ui label,
  .swagger-host .swagger-ui .opblock-tag,
  .swagger-host .swagger-ui .opblock .opblock-summary-operation-id,
  .swagger-host .swagger-ui .opblock .opblock-summary-path,
  .swagger-host .swagger-ui .opblock .opblock-summary-description,
  .swagger-host .swagger-ui .opblock-description-wrapper p,
  .swagger-host .swagger-ui .opblock-external-docs-wrapper p,
  .swagger-host .swagger-ui .parameter__name,
  .swagger-host .swagger-ui .parameter__type,
  .swagger-host .swagger-ui .parameter__in,
  .swagger-host .swagger-ui table thead tr th,
  .swagger-host .swagger-ui table thead tr td,
  .swagger-host .swagger-ui .response-col_status,
  .swagger-host .swagger-ui .response-col_links,
  .swagger-host .swagger-ui .model-title,
  .swagger-host .swagger-ui .model,
  .swagger-host .swagger-ui .tab li button.tablinks {
    color: var(--app-body-text);
  }
  .swagger-host .swagger-ui .opblock .opblock-section-header {
    background: var(--app-content-bg);
    box-shadow: none;
  }
  .swagger-host .swagger-ui .opblock-body pre.microlight { background: #0f172a; }
  .swagger-host .swagger-ui select,
  .swagger-host .swagger-ui input[type="text"],
  .swagger-host .swagger-ui input[type="password"],
  .swagger-host .swagger-ui textarea {
    background: var(--app-content-bg);
    color: var(--app-body-text);
    border-color: var(--app-border);
  }
}
`;
