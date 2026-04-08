"use client";

import { useEffect } from "react";

export default function TicketDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Ticket detail error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="max-w-md text-center space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: "var(--app-body-text)" }}>
          Error al cargar el ticket
        </h2>
        <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
          No se pudo cargar el detalle del ticket. Puede ser un problema temporal.
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
            href="/tickets"
            className="rounded-lg px-4 py-2 text-sm font-medium"
            style={{ border: "1px solid var(--app-border)", color: "var(--app-body-text)" }}
          >
            Volver a tickets
          </a>
        </div>
      </div>
    </div>
  );
}
