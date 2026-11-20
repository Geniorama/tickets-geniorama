"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BillingDocType, BillingStatus } from "@/generated/prisma";
import { DOC_NUMBER_LABELS, DOC_TYPES, DOC_TYPE_LABELS } from "@/lib/billing/doc-type";
import { BILLING_STATUSES, BILLING_STATUS_LABELS, isInvoiced } from "@/lib/billing/status";
import { createBillingItem, updateBillingItem } from "@/actions/billing.actions";
import { callAction } from "@/lib/run-action";
import { LineEditor, type Categoria } from "@/components/billing/line-editor";
import type { LineaConCategoria } from "@/lib/billing/totals";

type Initial = {
  id: string;
  concept: string;
  status: BillingStatus;
  lines: LineaConCategoria[];
  dueDate: string | null;
  invoiceDueDate: string | null;
  invoiceNumber: string | null;
  ownerId: string | null;
  docType: BillingDocType;
  receivedBy: string | null;
  dealId: string | null;
  notes: string | null;
};

export type DealOption = { id: string; title: string; stage: string; companyId: string };

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
  categorias,
  deals = [],
  initial,
  fixedCompanyId,
}: {
  companies: { id: string; name: string }[];
  owners: { id: string; name: string }[];
  categorias: Categoria[];
  deals?: DealOption[];
  initial?: Initial;
  fixedCompanyId?: string;
}) {
  const [companyId, setCompanyId] = useState(fixedCompanyId ?? companies[0]?.id ?? "");
  const [status, setStatus] = useState<BillingStatus>(initial?.status ?? "BACKLOG");
  const [docType, setDocType] = useState<BillingDocType>(initial?.docType ?? "FACTURA");
  const [dealId, setDealId] = useState(initial?.dealId ?? "");
  const dealsDeLaEmpresa = deals.filter((d) => d.companyId === companyId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const editando = Boolean(initial);

  // «Archivo» solo se ofrece si desde aquí se puede llegar: al archivo se va
  // después de cobrar, y el servidor rechaza cualquier otro salto. Ofrecerlo
  // igualmente sería enseñar una opción que devuelve un error.
  const puedeArchivar = initial?.status === "PAGADO" || initial?.status === "ARCHIVADO";
  const estadosOfrecidos = puedeArchivar
    ? BILLING_STATUSES
    : BILLING_STATUSES.filter((s) => s !== "ARCHIVADO");

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r = initial
        ? await callAction(() => updateBillingItem(initial.id, formData), { timeoutMs: 60000 })
        : await callAction(() => createBillingItem(formData), { timeoutMs: 60000 });
      if (r?.error) return setError(r.error);
      // Al editar se vuelve al cobro: el formulario vive ahora en su propia
      // pantalla, y quedarse en él tras guardar deja la duda de si guardó.
      if (initial) router.push(`/facturacion/${initial.id}`);
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
          <select
            id="company" value={companyId} style={inputStyle}
            onChange={(e) => { setCompanyId(e.target.value); setDealId(""); }}
          >
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      <div className="rg-2" style={{ display: "grid", gap: "0.75rem" }}>
        <div>
          <label htmlFor="docType" style={labelStyle}>Tipo de documento</label>
          <select
            id="docType" name="docType" value={docType} style={inputStyle}
            onChange={(e) => setDocType(e.target.value as BillingDocType)}
          >
            {DOC_TYPES.map((t) => <option key={t} value={t}>{DOC_TYPE_LABELS[t]}</option>)}
          </select>
          {docType === "CUENTA_COBRO" && (
            <p style={{ fontSize: "0.7rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
              Cobro que no pasa por la facturación de la agencia (por ejemplo, ventas al exterior).
            </p>
          )}
        </div>
        {docType === "CUENTA_COBRO" && (
          <div>
            <label htmlFor="receivedBy" style={labelStyle}>Quién recibe el dinero {opcional}</label>
            <input
              id="receivedBy" name="receivedBy" style={inputStyle} maxLength={120}
              defaultValue={initial?.receivedBy ?? ""} placeholder="Angel, Oscar…"
            />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="dealId" style={labelStyle}>Oportunidad del CRM {opcional}</label>
        <select
          id="dealId" name="dealId" value={dealId} style={inputStyle}
          onChange={(e) => setDealId(e.target.value)}
        >
          <option value="">Sin vincular</option>
          {dealsDeLaEmpresa.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
        </select>
        <p style={{ fontSize: "0.7rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
          Permite cruzar lo vendido en el CRM con lo que realmente se cobra.
        </p>
      </div>

      <LineEditor initial={initial?.lines} categorias={categorias} />

      <div>
        <label htmlFor="status" style={labelStyle}>Estado</label>
        <select
          id="status" name="status" value={status} style={inputStyle}
          onChange={(e) => setStatus(e.target.value as BillingStatus)}
        >
          {estadosOfrecidos.map((s) => (
            <option key={s} value={s}>{BILLING_STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div className="rg-2" style={{ display: "grid", gap: "0.75rem" }}>
        <div>
          <label htmlFor="dueDate" style={labelStyle}>Fecha de facturación {opcional}</label>
          <input
            id="dueDate" name="dueDate" type="date" style={inputStyle}
            defaultValue={initial?.dueDate ?? ""}
          />
          <p style={{ fontSize: "0.7rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
            Cuándo toca emitir {docType === "CUENTA_COBRO" ? "la cuenta de cobro" : "la factura"}.
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
        <div className="rg-2" style={{ display: "grid", gap: "0.75rem" }}>
          <div>
            <label htmlFor="invoiceNumber" style={labelStyle}>{DOC_NUMBER_LABELS[docType]}</label>
            <input
              id="invoiceNumber" name="invoiceNumber" style={inputStyle}
              // Solo exigido al pasar a facturado; un cobro antiguo ya facturado sin número se puede seguir editando.
              required={!initial || !isInvoiced(initial.status)}
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

      {error && <p style={{ fontSize: "0.8125rem", color: "var(--tone-red-fg)" }}>{error}</p>}

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
