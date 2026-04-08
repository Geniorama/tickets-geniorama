"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md text-center space-y-4">
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
        >
          <svg
            className="h-6 w-6"
            style={{ color: "#ef4444" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--app-body-text)" }}>
          Algo salio mal
        </h2>
        <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
          Ocurrio un error al cargar esta pagina. Puedes intentar de nuevo o volver al inicio.
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
            style={{
              border: "1px solid var(--app-border)",
              color: "var(--app-body-text)",
            }}
          >
            Ir al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
