"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BillingEmailStatus } from "@/generated/prisma";
import { cancelBillingEmail } from "@/actions/billing-emails.actions";
import { EMAIL_STATUS_COLORS, EMAIL_STATUS_LABELS } from "@/lib/billing/emails/labels";
import { formatDateTimeLong } from "@/lib/format-date";

/**
 * Los correos de un cobro —o de todos—: lo que espera su hora y lo que ya
 * salió. Lo programado se puede cancelar desde aquí hasta el último momento.
 */

export type CorreoRegistrado = {
  id: string;
  status: BillingEmailStatus;
  subject: string;
  templateName: string | null;
  recipients: string[];
  scheduledFor: Date | string | null;
  sentAt: Date | string | null;
  createdAt: Date | string;
  error: string | null;
  createdBy: string;
  /** Solo en la lista general: en la ficha del cobro ya se sabe cuál es. */
  cobro?: { id: string; concept: string; empresa: string };
};

function cuando(c: CorreoRegistrado): string {
  if (c.status === "PROGRAMADO" && c.scheduledFor) return `sale el ${formatDateTimeLong(c.scheduledFor)}`;
  if (c.sentAt) return formatDateTimeLong(c.sentAt);
  if (c.scheduledFor) return `era para el ${formatDateTimeLong(c.scheduledFor)}`;
  return formatDateTimeLong(c.createdAt);
}

export function EmailLog({ correos }: { correos: CorreoRegistrado[] }) {
  const [error, setError] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const router = useRouter();

  async function cancelar(id: string) {
    setError(null);
    setCancelando(id);
    try {
      const r = await cancelBillingEmail(id);
      if (r?.error) setError(r.error);
      router.refresh();
    } finally {
      setCancelando(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {error && <p style={{ fontSize: "0.75rem", color: "#b91c1c", margin: 0 }}>{error}</p>}

      {correos.map((c) => (
        <div
          key={c.id}
          style={{
            display: "flex", alignItems: "baseline", gap: "0.6rem", flexWrap: "wrap",
            padding: "0.55rem 0.75rem", borderRadius: "0.5rem",
            border: "1px solid var(--app-border)", fontSize: "0.8125rem",
          }}
        >
          <span style={{ fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.03em", color: EMAIL_STATUS_COLORS[c.status] }}>
            {EMAIL_STATUS_LABELS[c.status]}
          </span>
          <span style={{ color: "var(--app-body-text)", fontWeight: 500 }}>
            {c.templateName ?? c.subject}
          </span>
          {c.cobro && (
            <Link href={`/facturacion/${c.cobro.id}`} style={{ color: "#fd1384", textDecoration: "none" }}>
              {c.cobro.concept} · {c.cobro.empresa}
            </Link>
          )}
          <span style={{ color: "var(--app-text-muted)" }}>
            a {c.recipients.join(", ")} · {cuando(c)} · {c.createdBy}
          </span>
          {c.status === "PROGRAMADO" && (
            <button
              type="button"
              onClick={() => cancelar(c.id)}
              disabled={cancelando === c.id}
              style={{
                marginLeft: "auto", background: "none", border: "1px solid var(--app-border)",
                borderRadius: "9999px", padding: "0.15rem 0.6rem", fontSize: "0.75rem",
                color: "var(--app-text-muted)", cursor: cancelando === c.id ? "wait" : "pointer",
              }}
            >
              {cancelando === c.id ? "Cancelando..." : "Cancelar"}
            </button>
          )}
          {c.error && (
            <span style={{ width: "100%", color: "#b45309", fontSize: "0.75rem" }}>{c.error}</span>
          )}
        </div>
      ))}
    </div>
  );
}
