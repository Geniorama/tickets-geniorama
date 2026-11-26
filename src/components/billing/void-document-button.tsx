"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { voidBillingDocument } from "@/actions/billing.actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { callAction } from "@/lib/run-action";

/** «Anular» en la ficha de un cobro facturado: pide motivo y qué hacer con él. */
export function VoidDocumentButton({
  billingItemId, documento, bloqueo,
}: {
  billingItemId: string;
  /** «Factura FE-123»: lo que se está a punto de anular. */
  documento: string;
  /** Por qué no se puede ahora mismo, o `null`. */
  bloqueo: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [reemitir, setReemitir] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function cerrar() {
    setAbierto(false);
    setError(null);
  }

  function anular() {
    setError(null);
    if (bloqueo) return setError(bloqueo);
    if (!motivo.trim()) return setError("Escribe el motivo de la anulación.");
    startTransition(async () => {
      try {
        const r = await callAction(() => voidBillingDocument(billingItemId, motivo, reemitir));
        if (r && "error" in r && typeof r.error === "string") return setError(r.error);
        setAbierto(false);
        setMotivo("");
        router.refresh();
      } catch {
        setError("No se pudo anular. Recarga la página y comprueba el estado del cobro.");
      }
    });
  }

  const opciones = [
    { valor: true, titulo: "Volver a «Por facturar»", detalle: "El cobro sigue vivo para emitir un documento nuevo." },
    { valor: false, titulo: "Dar de baja el cobro", detalle: "Sale del tablero y de los totales. No se puede deshacer." },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          fontSize: "0.8125rem", padding: "0.5rem 0.95rem", borderRadius: "0.5rem",
          border: "1px solid var(--app-border)", background: "none", color: "#dc2626",
          cursor: "pointer", whiteSpace: "nowrap",
        }}
      >
        <Ban style={{ width: "0.85rem", height: "0.85rem" }} />
        Anular
      </button>

      <ConfirmDialog
        open={abierto}
        title={`¿Anular ${documento}?`}
        message={bloqueo ?? "Quedará en el cementerio con su número, importe y motivo. Los correos programados de este cobro se cancelan."}
        confirmLabel="Anular"
        variant="danger"
        isPending={pendiente}
        onConfirm={anular}
        onCancel={cerrar}
      >
        {!bloqueo && (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.8125rem", color: "var(--app-body-text)" }}>
              Motivo
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={3}
                maxLength={1000}
                style={{
                  width: "100%", boxSizing: "border-box", resize: "vertical",
                  fontSize: "0.875rem", padding: "0.5rem 0.65rem", borderRadius: "0.5rem",
                  border: "1px solid var(--app-border)", backgroundColor: "var(--app-content-bg)",
                  color: "var(--app-body-text)",
                }}
              />
            </label>
            <fieldset style={{ border: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <legend style={{ fontSize: "0.8125rem", color: "var(--app-body-text)", marginBottom: "0.4rem" }}>
                Qué pasa con el cobro
              </legend>
              {opciones.map((o) => (
                <label key={o.titulo} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="destino-anulacion"
                    checked={reemitir === o.valor}
                    onChange={() => setReemitir(o.valor)}
                    style={{ marginTop: "0.2rem" }}
                  />
                  <span style={{ fontSize: "0.8125rem", color: "var(--app-body-text)" }}>
                    {o.titulo}
                    <span style={{ display: "block", color: "var(--app-text-muted)", fontSize: "0.75rem" }}>{o.detalle}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </>
        )}
        {error && !bloqueo && (
          <p role="alert" style={{ margin: 0, color: "#dc2626", fontSize: "0.8125rem" }}>{error}</p>
        )}
      </ConfirmDialog>
    </>
  );
}
