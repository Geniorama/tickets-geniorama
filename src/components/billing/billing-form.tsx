"use client";

import { useState, useTransition } from "react";
import type { BillingStatus } from "@/generated/prisma";
import { BILLING_STATUSES, BILLING_STATUS_LABELS, isInvoiced } from "@/lib/billing/status";
import { createBillingItem, updateBillingItem } from "@/actions/billing.actions";
import { LineEditor } from "@/components/billing/line-editor";
import type { LineaCobro } from "@/lib/billing/totals";

type Initial = {
  id: string;
  concept: string;
  status: BillingStatus;
  lines: LineaCobro[];
  dueDate: string | null;
  invoiceDueDate: string | null;
  invoiceNumber: string | null;
  ownerId: string | null;
  notes: string | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.55rem 0.75rem", fontSize: "0.875rem",
  borderRadius: "0.5rem", border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.8125rem", fontWeight: 600,
  color: "var(--app-body-text)", marginBottom: "0.3rem",
};
const opcional = <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(opcional)</span>;

export function BillingForm({
  companies,
  owners,
  initial,
  fixedCompanyId,
}: {
  companies: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  initial?: Initial;
  fixedCompanyId?: string;
}) {
  const [companyId, setCompanyId] = useState(fixedCompanyId ?? companies[0]?.id ?? "");
  const [status, setStatus] = useState<BillingStatus>(initial?.status ?? "BACKLOG");
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [isPending, startTransition] = useTransition();

  const editando = Boolean(initial);

  function handleSubmit(formData: FormData) {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const r = initial
        ? await updateBillingItem(initial.id, formData)
        : await createBillingItem(formData);
      if (r?.error) setError(r.error);
      else if (initial) setGuardado(true);
    });
  }

  return (
    <form
      action={handleSubmit}
      style={{
        backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
        borderRadius: "0.75rem", padding: "1.5rem",
        display: "flex", flexDirection: "column", gap: "1rem",
      }}
    >
      <input type="hidden" name="companyId" value={companyId} />

      <div>
        <label htmlFor="concept" style={labelStyle}>Título del cobro</label>
        <input
          id="concept" name="concept" required autoFocus={!editando} style={inputStyle}
          defaultValue={initial?.concept}
          placeholder="Servicios septiembre — Yamaha UMB"
        />
        <p style={{ fontSize: "0.7rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
          Cómo se reconoce en el tablero. El detalle va abajo, en los conceptos.
        </p>
      </div>

      <div>
        <label htmlFor="company" style={labelStyle}>Empresa</label>
        {fixedCompanyId ? (
          <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", padding: "0.55rem 0" }}>
            {companies.find((c) => c.id === companyId)?.name ?? "—"}
          </p>
        ) : (
          <select id="company" value={companyId} style={inputStyle} onChange={(e) => setCompanyId(e.target.value)}>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <LineEditor initial={initial?.lines} />

      <div>
        <label htmlFor="status" style={labelStyle}>Estado</label>
        <select
          id="status" name="status" value={status} style={inputStyle}
          onChange={(e) => setStatus(e.target.value as BillingStatus)}
        >
          {BILLING_STATUSES.map((s) => (
            <option key={s} value={s}>{BILLING_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label htmlFor="dueDate" style={labelStyle}>Fecha de facturación {opcional}</label>
          <input
            id="dueDate" name="dueDate" type="date" style={inputStyle}
            defaultValue={initial?.dueDate ?? ""}
          />
          <p style={{ fontSize: "0.7rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
            Cuándo toca emitir la factura.
          </p>
        </div>
        <div>
          <label htmlFor="ownerId" style={labelStyle}>Responsable {opcional}</label>
          <select id="ownerId" name="ownerId" defaultValue={initial?.ownerId ?? ""} style={inputStyle}>
            <option value="">Sin asignar</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      </div>

      {/* El número de factura solo existe cuando ya se emitió: pedirlo antes
          invita a inventárselo. */}
      {isInvoiced(status) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div>
            <label htmlFor="invoiceNumber" style={labelStyle}>Número de factura {opcional}</label>
            <input
              id="invoiceNumber" name="invoiceNumber" style={inputStyle}
              defaultValue={initial?.invoiceNumber ?? ""}
              placeholder="FV-1042"
            />
          </div>
          <div>
            <label htmlFor="invoiceDueDate" style={labelStyle}>Vence el {opcional}</label>
            <input
              id="invoiceDueDate" name="invoiceDueDate" type="date" style={inputStyle}
              defaultValue={initial?.invoiceDueDate ?? ""}
            />
            <p style={{ fontSize: "0.7rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
              De aquí cuelgan los recordatorios automáticos.
            </p>
          </div>
        </div>
      )}

      <div>
        <label htmlFor="notes" style={labelStyle}>Notas {opcional}</label>
        <textarea
          id="notes" name="notes" rows={3} style={{ ...inputStyle, resize: "vertical" }}
          defaultValue={initial?.notes ?? ""}
        />
      </div>

      {error && <p style={{ fontSize: "0.8125rem", color: "#b91c1c" }}>{error}</p>}
      {guardado && !error && <p style={{ fontSize: "0.8125rem", color: "#16a34a" }}>Cambios guardados.</p>}

      <button
        type="submit"
        disabled={isPending || !companyId}
        style={{
          alignSelf: "flex-start", backgroundColor: "#fd1384", color: "#fff",
          border: "none", borderRadius: "0.5rem", padding: "0.55rem 1.25rem",
          fontSize: "0.875rem", fontWeight: 500,
          cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? "Guardando..." : editando ? "Guardar cambios" : "Crear cobro"}
      </button>
    </form>
  );
}
