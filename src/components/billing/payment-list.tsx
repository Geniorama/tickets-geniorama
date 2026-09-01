"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { AmountInput } from "@/components/ui/amount-input";
import { formatAmount } from "@/lib/money";
import { formatDate } from "@/lib/format-date";
import { addBillingPayment, deleteBillingPayment } from "@/actions/billing-payments.actions";

/**
 * Los abonos de un cobro.
 *
 * Casi ningún cliente paga de una vez: un anticipo, otro al entregar, el saldo
 * a treinta días. Cada uno se apunta con su fecha, porque contabilidad no
 * pregunta solo cuánto entró sino cuándo.
 *
 * La columna del tablero no se toca aquí: la decide el dinero. Al cubrir el
 * total, el cobro pasa a «Pagado» solo.
 */

export type Abono = {
  id: string;
  amount: number;
  paidOn: Date | string;
  method: string | null;
  note: string | null;
  registeredBy: { name: string };
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.7rem", fontSize: "0.875rem",
  borderRadius: "0.5rem", border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
};

export function PaymentList({
  billingItemId,
  abonos,
  total,
  cobrado,
  facturado,
  canEdit,
  canManage,
}: {
  billingItemId: string;
  abonos: Abono[];
  total: number;
  cobrado: number;
  /** Sin factura emitida no se apunta ningún pago. */
  facturado: boolean;
  canEdit: boolean;
  /** Quitar un abono cambia lo cobrado: pide GESTOR. */
  canManage: boolean;
}) {
  const [abriendo, setAbriendo] = useState(false);
  const [importe, setImporte] = useState("");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const falta = Math.max(0, Math.round(total) - Math.round(cobrado));
  const hoy = new Date().toLocaleDateString("en-CA");

  /**
   * El refresco va **fuera** de una transición, y no es un detalle de estilo.
   *
   * Esta pantalla la pinta el servidor, así que tras guardar un abono hay que
   * volver a pedirla: `revalidatePath` limpia la caché del servidor, pero el
   * navegador sigue enseñando la lista que ya tenía. Metido dentro de
   * `startTransition`, junto a la llamada del formulario, el refresco no
   * llegaba a aplicarse —se probó, y el pago se guardaba pero la lista no se
   * movía hasta recargar a mano—. Aquí se espera al servidor y luego se pide
   * la pantalla de nuevo, que es lo que sí funciona.
   */
  async function enviar(formData: FormData) {
    setError(null);
    setIsPending(true);
    try {
      const r = await addBillingPayment(billingItemId, formData);
      if (r?.error) return setError(r.error);
      setImporte("");
      formRef.current?.reset();
      setAbriendo(false);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  async function borrar(id: string) {
    setError(null);
    setIsPending(true);
    try {
      const r = await deleteBillingPayment(id, billingItemId);
      if (r?.error) return setError(r.error);
      router.refresh();
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
        borderRadius: "0.75rem", padding: "1.25rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
          Abonos
        </p>
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: 0 }}>
          {abonos.length > 0 && (
            <>
              {abonos.length} {abonos.length === 1 ? "abono" : "abonos"} ·{" "}
              <span style={{ color: "var(--app-body-text)" }}>{formatAmount(cobrado)}</span>
              {falta > 0 && (
                <> · faltan <span style={{ color: "#dc2626" }}>{formatAmount(falta)}</span></>
              )}
            </>
          )}
        </p>
      </div>

      {error && <p style={{ fontSize: "0.8125rem", color: "#b91c1c", marginTop: "0.6rem" }}>{error}</p>}

      {abonos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginTop: "0.85rem" }}>
          {abonos.map((a) => (
            <div
              key={a.id}
              style={{
                display: "flex", alignItems: "baseline", gap: "0.6rem", flexWrap: "wrap",
                padding: "0.5rem 0.7rem", borderRadius: "0.5rem",
                border: "1px solid var(--app-border)",
              }}
            >
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#16a34a", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {formatAmount(a.amount)}
              </span>
              <span style={{ fontSize: "0.8125rem", color: "var(--app-nav-text)" }}>
                {formatDate(a.paidOn)}
                {a.method && <span style={{ color: "var(--app-text-muted)" }}> · {a.method}</span>}
              </span>
              <span style={{ flex: 1, minWidth: "6rem", fontSize: "0.6875rem", color: "var(--app-text-muted)", textAlign: "right" }}>
                {a.registeredBy.name}
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => borrar(a.id)}
                  disabled={isPending}
                  aria-label={`Quitar abono de ${formatAmount(a.amount)}`}
                  style={{ background: "none", border: "none", padding: 0, color: "#dc2626", cursor: "pointer", display: "inline-flex" }}
                >
                  <Trash2 style={{ width: "0.85rem", height: "0.85rem" }} />
                </button>
              )}
              {a.note && (
                <span style={{ width: "100%", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>{a.note}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {!facturado ? (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginTop: "0.85rem" }}>
          Para apuntar un pago, el cobro tiene que estar facturado. No se cobra lo que el cliente
          todavía no ha recibido.
        </p>
      ) : abonos.length === 0 && !abriendo ? (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginTop: "0.85rem" }}>
          Todavía no ha entrado nada.
        </p>
      ) : null}

      {canEdit && facturado && (abriendo ? (
        <form ref={formRef} action={enviar} style={{ marginTop: "0.85rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <div>
              <label htmlFor="amount" style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginBottom: "0.2rem" }}>
                Cuánto entró
              </label>
              <AmountInput
                id="amount" name="amount" value={importe} onValueChange={setImporte}
                placeholder={falta > 0 ? String(falta) : "500.000"}
                ariaLabel="Importe del abono"
                style={{ ...inputStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
              />
              {falta > 0 && (
                <button
                  type="button"
                  onClick={() => setImporte(new Intl.NumberFormat("es-CO").format(falta))}
                  style={{ background: "none", border: "none", padding: 0, marginTop: "0.25rem", fontSize: "0.7rem", color: "#fd1384", cursor: "pointer" }}
                >
                  Poner lo que falta ({formatAmount(falta)})
                </button>
              )}
            </div>
            <div>
              <label htmlFor="paidOn" style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginBottom: "0.2rem" }}>
                Cuándo entró
              </label>
              <input id="paidOn" name="paidOn" type="date" required defaultValue={hoy} style={inputStyle} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <input name="method" placeholder="Cómo llegó (opcional)" maxLength={80} style={inputStyle} />
            <input name="note" placeholder="Nota (opcional)" maxLength={500} style={inputStyle} />
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="submit" disabled={isPending}
              style={{
                backgroundColor: "#16a34a", color: "#fff", border: "none", borderRadius: "0.5rem",
                padding: "0.5rem 1rem", fontSize: "0.875rem", fontWeight: 500,
                cursor: isPending ? "wait" : "pointer", opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? "Guardando..." : "Registrar abono"}
            </button>
            <button
              type="button" onClick={() => { setAbriendo(false); setError(null); }}
              style={{ border: "1px solid var(--app-border)", background: "none", borderRadius: "0.5rem", padding: "0.5rem 0.9rem", fontSize: "0.875rem", color: "var(--app-text-muted)", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => { setAbriendo(true); setError(null); }}
          style={{
            display: "inline-flex", alignItems: "center", gap: "0.3rem", marginTop: "0.85rem",
            background: "none", border: "none", padding: 0,
            fontSize: "0.8125rem", fontWeight: 500, color: "#fd1384", cursor: "pointer",
          }}
        >
          <Plus style={{ width: "0.9rem", height: "0.9rem" }} />
          Registrar abono
        </button>
      ))}
    </div>
  );
}
