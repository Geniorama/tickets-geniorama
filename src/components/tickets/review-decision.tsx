"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RotateCcw, Eye } from "lucide-react";
import { respondToReview } from "@/actions/ticket-review.actions";
import { runAction } from "@/lib/run-action";

/**
 * Lo que ve el cliente cuando el equipo deja su ticket En revisión: aprobar el
 * trabajo (se cierra) o pedir cambios (se reabre, con el motivo en el hilo).
 */
export function ReviewDecision({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  function send(decision: "approve" | "reopen") {
    setError(null);
    startTransition(async () => {
      const r = await runAction(() => respondToReview(ticketId, decision, note), { timeoutMs: 45_000 });
      if (!r.ok) return setError(r.error);
      if ("error" in r.data && r.data.error) return setError(r.data.error);
      setAsking(false);
      setNote("");
      router.refresh();
    });
  }

  const buttonBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.375rem",
    height: "2.25rem",
    padding: "0 0.875rem",
    borderRadius: "0.5rem",
    fontSize: "0.8125rem",
    fontWeight: 600,
    cursor: isPending ? "wait" : "pointer",
    opacity: isPending ? 0.7 : 1,
  };

  return (
    <div
      style={{
        padding: "1rem 1.125rem",
        borderRadius: "0.75rem",
        backgroundColor: "var(--tone-purple-bg)",
        border: "1px solid var(--tone-purple-bd)",
        color: "var(--tone-purple-fg)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontWeight: 600, fontSize: "0.9375rem" }}>
        <Eye style={{ width: "1rem", height: "1rem" }} />
        Tu ticket está listo para revisar
      </div>
      <p style={{ margin: "0.375rem 0 0.875rem", fontSize: "0.8125rem", lineHeight: 1.5 }}>
        Revisa el resultado. Si todo está bien, apruébalo y lo cerramos; si falta algo, cuéntanos qué y lo retomamos.
      </p>

      {asking ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            autoFocus
            placeholder="¿Qué falta o qué no quedó bien?"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              border: "1px solid var(--app-border)",
              backgroundColor: "var(--app-card-bg)",
              color: "var(--app-body-text)",
              fontSize: "0.8125rem",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={isPending || note.trim().length < 3}
              onClick={() => send("reopen")}
              style={{
                ...buttonBase,
                backgroundColor: "var(--tone-orange-bg)",
                color: "var(--tone-orange-fg)",
                border: "1px solid var(--tone-orange-bd)",
                opacity: isPending || note.trim().length < 3 ? 0.55 : 1,
              }}
            >
              <RotateCcw style={{ width: "0.875rem", height: "0.875rem" }} />
              {isPending ? "Enviando..." : "Enviar y reabrir"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => { setAsking(false); setError(null); }}
              style={{ ...buttonBase, background: "none", color: "inherit", border: "1px solid var(--tone-purple-bd)" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            disabled={isPending}
            onClick={() => send("approve")}
            style={{
              ...buttonBase,
              backgroundColor: "var(--tone-green-bg)",
              color: "var(--tone-green-fg)",
              border: "1px solid var(--tone-green-bd)",
            }}
          >
            <CheckCircle2 style={{ width: "0.875rem", height: "0.875rem" }} />
            {isPending ? "Enviando..." : "Aprobar y cerrar"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => setAsking(true)}
            style={{ ...buttonBase, background: "none", color: "inherit", border: "1px solid var(--tone-purple-bd)" }}
          >
            <RotateCcw style={{ width: "0.875rem", height: "0.875rem" }} />
            Pedir cambios
          </button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          style={{
            margin: "0.75rem 0 0",
            padding: "0.5rem 0.75rem",
            borderRadius: "0.5rem",
            fontSize: "0.8125rem",
            backgroundColor: "var(--tone-red-bg)",
            color: "var(--tone-red-fg)",
            border: "1px solid var(--tone-red-bd)",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
