"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, CreditCard, Link2, Mail } from "lucide-react";
import { generatePayLink } from "@/actions/paylink.actions";
import { formatAmount } from "@/lib/money";
import { formatDate } from "@/lib/format-date";

/**
 * El link de pago en línea del cobro: generarlo, copiarlo y mandárselo al
 * cliente. Debajo, los intentos de pago que ha habido, para saber si el
 * cliente llegó a abrirlo y en qué quedó.
 */

export type IntentoDePago = {
  id: string;
  amount: number;
  status: string;
  createdAt: Date;
};

const ESTADO: Record<string, { label: string; color: string }> = {
  created:   { label: "Sin terminar", color: "#64748b" },
  pending:   { label: "En proceso",   color: "#b45309" },
  success:   { label: "Pagado",       color: "#16a34a" },
  failed:    { label: "Rechazado",    color: "#dc2626" },
  cancelled: { label: "Cancelado",    color: "#64748b" },
  refunded:  { label: "Devuelto",     color: "#dc2626" },
};

const boton: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.35rem",
  fontSize: "0.8125rem", padding: "0.4rem 0.85rem", borderRadius: "0.5rem",
  border: "1px solid var(--app-border)", backgroundColor: "transparent",
  color: "var(--app-nav-text)", cursor: "pointer", textDecoration: "none",
};

export function PayLinkCard({
  billingItemId,
  url,
  motivo,
  falta,
  canEdit,
  hrefCorreo,
  intentos,
}: {
  billingItemId: string;
  /** El link ya generado, o null si aún no se ha pedido. */
  url: string | null;
  /** Por qué no se puede pagar en línea ahora. null si se puede. */
  motivo: string | null;
  falta: number;
  canEdit: boolean;
  /** Adónde lleva «Enviar al cliente»: el correo ya preparado. null sin plantilla. */
  hrefCorreo: string | null;
  intentos: IntentoDePago[];
}) {
  const [link, setLink] = useState(url);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function generar() {
    setError(null);
    setIsPending(true);
    try {
      const r = await generatePayLink(billingItemId);
      if (r.error) setError(r.error);
      else if (r.url) {
        setLink(r.url);
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  function copiar() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
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
          Pago en línea
        </p>
        {!link && !motivo && canEdit && (
          <button type="button" onClick={generar} disabled={isPending} style={{ ...boton, opacity: isPending ? 0.6 : 1 }}>
            <Link2 style={{ width: "0.85rem", height: "0.85rem" }} />
            {isPending ? "Generando..." : "Generar link de pago"}
          </button>
        )}
      </div>

      {motivo ? (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: "0.75rem 0 0" }}>
          {motivo}.{link ? " El link que ya se mandó lo dirá al abrirlo." : ""}
        </p>
      ) : !link ? (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: "0.75rem 0 0" }}>
          Genera un link para que el cliente pague {formatAmount(falta)} con Payments Way. El abono se
          apunta solo cuando el pago se confirma.
        </p>
      ) : (
        <div style={{ marginTop: "0.85rem" }}>
          <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: "0 0 0.5rem" }}>
            Con este link el cliente paga los {formatAmount(falta)} que faltan. Cobra siempre el saldo
            del momento, así que sigue sirviendo después de un abono.
          </p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <input
              readOnly value={link} aria-label="Link de pago"
              onFocus={(e) => e.currentTarget.select()}
              style={{
                flex: "1 1 16rem", minWidth: 0, padding: "0.45rem 0.7rem", fontSize: "0.8125rem",
                borderRadius: "0.5rem", border: "1px solid var(--app-border)",
                backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
              }}
            />
            <button type="button" onClick={copiar} style={boton}>
              {copiado
                ? <Check style={{ width: "0.85rem", height: "0.85rem", color: "#16a34a" }} />
                : <Copy style={{ width: "0.85rem", height: "0.85rem" }} />}
              {copiado ? "Copiado" : "Copiar"}
            </button>
            {hrefCorreo && (
              <Link href={hrefCorreo} style={{ ...boton, backgroundColor: "#fd1384", borderColor: "#fd1384", color: "#ffffff" }}>
                <Mail style={{ width: "0.85rem", height: "0.85rem" }} />
                Enviar al cliente
              </Link>
            )}
          </div>
        </div>
      )}

      {error && <p style={{ fontSize: "0.8125rem", color: "#b91c1c", margin: "0.75rem 0 0" }}>{error}</p>}

      {intentos.length > 0 && (
        <div style={{ marginTop: "1rem", borderTop: "1px solid var(--app-border)", paddingTop: "0.75rem" }}>
          <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--app-text-muted)", margin: "0 0 0.4rem" }}>
            Intentos de pago
          </p>
          {intentos.map((i) => {
            const e = ESTADO[i.status] ?? ESTADO.pending;
            return (
              <div key={i.id} style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.8125rem", padding: "0.25rem 0", flexWrap: "wrap" }}>
                <CreditCard style={{ width: "0.85rem", height: "0.85rem", color: "var(--app-icon-color)" }} />
                <span style={{ color: "var(--app-body-text)" }}>{formatAmount(i.amount)}</span>
                <span style={{ color: e.color, fontWeight: 600 }}>{e.label}</span>
                <span style={{ color: "var(--app-text-muted)" }}>{formatDate(i.createdAt)} · {i.id}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
