"use client";

import { useEffect } from "react";

export default function ReportesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Reportes error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--app-body-text)" }}>
          Error al cargar los reportes
        </h2>
        <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
          No se pudieron cargar los datos de reportes. Puede ser un problema temporal.
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
            href="/dashboard"
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ border: "1px solid var(--app-border)", color: "var(--app-body-text)" }}
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
