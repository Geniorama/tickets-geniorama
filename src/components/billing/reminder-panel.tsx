"use client";

import { useState, useTransition } from "react";
import { BellOff, Bell } from "lucide-react";
import type { ReminderChannel, ReminderStatus } from "@/generated/prisma";
import { setRemindersOff } from "@/actions/billing-reminders.actions";
import { CHANNEL_LABELS } from "@/lib/billing/reminders/labels";
import { formatDateTimeLong } from "@/lib/format-date";

/**
 * Los recordatorios de este cobro: los que ya salieron y el interruptor para
 * dejar de perseguir a un cliente que ya avisó de cuándo paga.
 *
 * Silenciar es por cobro y no por empresa: que hayan acordado una fecha para
 * una factura no significa que se les deje de reclamar el resto.
 */

export type Salido = {
  id: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  recipientName: string | null;
  recipient: string;
  sentAt: Date | string;
  error: string | null;
  regla: string | null;
};

export function ReminderPanel({
  billingItemId,
  off,
  salidos,
  canEdit,
  tieneVencimiento,
  facturado,
}: {
  billingItemId: string;
  off: boolean;
  salidos: Salido[];
  canEdit: boolean;
  tieneVencimiento: boolean;
  /** Si la factura ya se emitió. Antes de eso no se reclama nada. */
  facturado: boolean;
}) {
  const [silenciado, setSilenciado] = useState(off);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function alternar() {
    const siguiente = !silenciado;
    setSilenciado(siguiente);
    startTransition(async () => {
      const r = await setRemindersOff(billingItemId, siguiente);
      if (r?.error) {
        setSilenciado(!siguiente);
        setError(r.error);
      }
    });
  }

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
        borderRadius: "0.75rem", padding: "1.25rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
          Recordatorios
        </p>
        {canEdit && (
          <button
            type="button"
            onClick={alternar}
            disabled={isPending}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.35rem",
              fontSize: "0.75rem", padding: "0.3rem 0.7rem", borderRadius: "9999px",
              border: `1px solid ${silenciado ? "#f59e0b" : "var(--app-border)"}`,
              backgroundColor: silenciado ? "#f59e0b22" : "transparent",
              color: silenciado ? "#f59e0b" : "var(--app-text-muted)",
              cursor: "pointer",
            }}
          >
            {silenciado
              ? <><BellOff style={{ width: "0.75rem", height: "0.75rem" }} /> Silenciado</>
              : <><Bell style={{ width: "0.75rem", height: "0.75rem" }} /> Silenciar</>}
          </button>
        )}
      </div>

      {error && <p style={{ fontSize: "0.75rem", color: "#b91c1c", marginTop: "0.5rem" }}>{error}</p>}

      <div style={{ marginTop: "0.85rem" }}>
        {silenciado ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: 0 }}>
            No se le reclamará nada por este cobro hasta que se quite el silencio.
          </p>
        ) : !facturado ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: 0 }}>
            No se reclama nada hasta que la factura esté emitida. Al pasarlo a
            «Facturado» aparecerá el campo «Vence el», y de ahí cuelgan las reglas.
          </p>
        ) : !tieneVencimiento ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: 0 }}>
            Sin fecha de vencimiento no entra en ninguna regla. Ponla en «Vence el».
          </p>
        ) : salidos.length === 0 ? (
          <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: 0 }}>
            Todavía no ha salido ninguno.
          </p>
        ) : null}

        {salidos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: salidos.length && !silenciado ? 0 : "0.6rem" }}>
            {salidos.map((s) => (
              <div key={s.id} style={{ fontSize: "0.8125rem" }}>
                <span
                  style={{
                    fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.03em", marginRight: "0.4rem",
                    color: s.status === "SENT" ? "#22c55e" : s.status === "FAILED" ? "#dc2626" : "#f59e0b",
                  }}
                >
                  {s.status === "SENT" ? "ENVIADO" : s.status === "FAILED" ? "FALLÓ" : "SIN SALIR"}
                </span>
                <span style={{ color: "var(--app-body-text)" }}>
                  {CHANNEL_LABELS[s.channel]} a {s.recipientName ?? s.recipient}
                </span>
                <span style={{ display: "block", fontSize: "0.6875rem", color: "var(--app-text-muted)", marginTop: "0.1rem" }}>
                  {s.regla ?? "regla borrada"} · {formatDateTimeLong(s.sentAt)}
                </span>
                {s.error && (
                  <span style={{ display: "block", fontSize: "0.6875rem", color: "#b45309" }}>{s.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
