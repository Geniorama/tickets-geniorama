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
 * Ajustes sobre la hoja de estilos de Swagger UI.
 *
 * Van colgados de `html:not(.light)` y no de `prefers-color-scheme` porque el
 * tema de la aplicación lo decide `next-themes` con una clase en `<html>`, y el
 * oscuro es el predeterminado: atarlo a la preferencia del sistema significaba
 * que estos ajustes no se aplicaban a quien tuviera el sistema en claro y la
 * app en oscuro, que es el caso habitual.
 *
 * Se toca lo mínimo. El resto de la interfaz se deja tal cual, que es
 * justamente lo que la hace reconocible para quien ya ha usado Swagger.
 */
const OVERRIDES = `
/* ── Encaje dentro del panel ─────────────────────────────────────────────── */
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

/* ── El botón de copiar dibujaba dos iconos ──────────────────────────────── */
/* El icono de Swagger son dos capas: una imagen de fondo con el glifo oscuro y,
   encima, un <svg> cuyo path lleva \`fill="#ffffff"\` fijo. Sobre un fondo claro
   se leen como uno solo, pero en oscuro se ven desalineadas y parecen dos.
   Se deja una sola capa —el SVG— y se le quita el blanco fijo para que siga al
   color del texto y funcione en los dos temas. */
.swagger-host .swagger-ui .copy-to-clipboard,
.swagger-host .swagger-ui .copy-to-clipboard button {
  background-image: none;
  /* Explícito y no heredado: el contenedor del icono trae su propio color y
     dejarlo a la herencia lo volvía invisible en uno de los dos temas. */
  color: #3b4151;
}
.swagger-host .swagger-ui .copy-to-clipboard button svg,
.swagger-host .swagger-ui .copy-to-clipboard button svg path {
  fill: currentColor;
}
html:not(.light) .swagger-host .swagger-ui .copy-to-clipboard,
html:not(.light) .swagger-host .swagger-ui .copy-to-clipboard button {
  color: var(--app-body-text);
}

/* ── Tema oscuro de la app ───────────────────────────────────────────────── */
html:not(.light) .swagger-host .swagger-ui,
html:not(.light) .swagger-host .swagger-ui .info .title,
html:not(.light) .swagger-host .swagger-ui .info li,
html:not(.light) .swagger-host .swagger-ui .info p,
html:not(.light) .swagger-host .swagger-ui .info table,
html:not(.light) .swagger-host .swagger-ui label,
html:not(.light) .swagger-host .swagger-ui .opblock-tag,
html:not(.light) .swagger-host .swagger-ui .opblock-tag small,
html:not(.light) .swagger-host .swagger-ui .opblock .opblock-summary-operation-id,
html:not(.light) .swagger-host .swagger-ui .opblock .opblock-summary-path,
html:not(.light) .swagger-host .swagger-ui .opblock .opblock-summary-description,
html:not(.light) .swagger-host .swagger-ui .opblock-description-wrapper p,
html:not(.light) .swagger-host .swagger-ui .opblock-external-docs-wrapper p,
html:not(.light) .swagger-host .swagger-ui .opblock-title_normal p,
html:not(.light) .swagger-host .swagger-ui .parameter__name,
html:not(.light) .swagger-host .swagger-ui .parameter__type,
html:not(.light) .swagger-host .swagger-ui .parameter__in,
html:not(.light) .swagger-host .swagger-ui .parameter__extension,
html:not(.light) .swagger-host .swagger-ui table thead tr th,
html:not(.light) .swagger-host .swagger-ui table thead tr td,
html:not(.light) .swagger-host .swagger-ui .response-col_status,
html:not(.light) .swagger-host .swagger-ui .response-col_links,
html:not(.light) .swagger-host .swagger-ui .responses-inner h4,
html:not(.light) .swagger-host .swagger-ui .responses-inner h5,
html:not(.light) .swagger-host .swagger-ui .model-title,
html:not(.light) .swagger-host .swagger-ui .model,
html:not(.light) .swagger-host .swagger-ui .model-toggle,
html:not(.light) .swagger-host .swagger-ui .tab li button.tablinks,
html:not(.light) .swagger-host .swagger-ui .dialog-ux .modal-ux-header h3,
html:not(.light) .swagger-host .swagger-ui .dialog-ux .modal-ux-content h4,
html:not(.light) .swagger-host .swagger-ui .dialog-ux .modal-ux-content p {
  color: var(--app-body-text);
}

/* El candado usa fill="currentColor": sin esto queda negro sobre fondo oscuro. */
html:not(.light) .swagger-host .swagger-ui .authorization__btn,
html:not(.light) .swagger-host .swagger-ui .authorization__btn svg,
html:not(.light) .swagger-host .swagger-ui .copy-to-clipboard button svg,
html:not(.light) .swagger-host .swagger-ui .expand-operation svg,
html:not(.light) .swagger-host .swagger-ui .models-control svg,
html:not(.light) .swagger-host .swagger-ui .model-box-control svg,
html:not(.light) .swagger-host .swagger-ui .opblock-control-arrow svg,
html:not(.light) .swagger-host .swagger-ui .opblock-summary-control svg {
  color: var(--app-body-text);
  fill: currentColor;
}
/* El candado cerrado es el estado con autorización activa: verde, como en el
   Swagger de siempre, para que se distinga de un vistazo del abierto. */
html:not(.light) .swagger-host .swagger-ui .authorization__btn svg.locked {
  color: #49cc90;
}

html:not(.light) .swagger-host .swagger-ui .opblock .opblock-section-header {
  background: var(--app-content-bg);
  box-shadow: none;
}
html:not(.light) .swagger-host .swagger-ui .opblock-body pre.microlight,
html:not(.light) .swagger-host .swagger-ui .highlight-code > .microlight {
  background: #0f172a;
}
html:not(.light) .swagger-host .swagger-ui .model-box,
html:not(.light) .swagger-host .swagger-ui section.models,
html:not(.light) .swagger-host .swagger-ui .dialog-ux .modal-ux {
  background: var(--app-card-bg);
  border-color: var(--app-border);
}
html:not(.light) .swagger-host .swagger-ui select,
html:not(.light) .swagger-host .swagger-ui input[type="text"],
html:not(.light) .swagger-host .swagger-ui input[type="password"],
html:not(.light) .swagger-host .swagger-ui input[type="email"],
html:not(.light) .swagger-host .swagger-ui textarea {
  background: var(--app-content-bg);
  color: var(--app-body-text);
  border-color: var(--app-border);
}
`;
