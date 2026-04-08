"use client";

import { useEffect } from "react";

export default function ProjectDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Project detail error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--app-body-text)" }}>
          Error al cargar el proyecto
        </h2>
        <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
          No se pudo cargar el detalle del proyecto. Puede ser un problema temporal.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "var(--app-primary)" }}
          >
            Intentar de nuevo
          </button>
          <a
            href="/proyectos"
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ border: "1px solid var(--app-border)", color: "var(--app-body-text)" }}
          >
            Volver a proyectos
          </a>
        </div>
      </div>
    </div>
  );
}
