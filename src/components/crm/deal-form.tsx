"use client";

import { useState, useTransition } from "react";
import type { DealStage } from "@/generated/prisma";
import { DEAL_STAGES, DEAL_STAGE_LABELS } from "@/lib/crm/deals";
import { createDeal, updateDeal } from "@/actions/crm.actions";

export type FormAccount = {
  id: string;
  name: string;
  contacts: { id: string; name: string }[];
};

type Initial = {
  id: string;
  title: string;
  stage: DealStage;
  amount: number | null;
  expectedCloseAt: string | null;
  contactId: string | null;
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

/**
 * Alta y edición de una oportunidad. La cuenta solo se elige al crearla: mover
 * el historial de una empresa a otra no es editar un campo.
 */
export function DealForm({
  accounts,
  owners,
  initial,
  fixedAccountId,
}: {
  accounts: FormAccount[];
  owners: { id: string; name: string }[];
  initial?: Initial;
  fixedAccountId?: string;
}) {
  const [accountId, setAccountId] = useState(fixedAccountId ?? accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [isPending, startTransition] = useTransition();

  const cuenta = accounts.find((a) => a.id === accountId);
  const editando = Boolean(initial);

  function handleSubmit(formData: FormData) {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const result = initial
        ? await updateDeal(initial.id, formData)
        : await createDeal(formData);
      if (result?.error) setError(result.error);
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
      <input type="hidden" name="companyId" value={accountId} />

      <div>
        <label htmlFor="title" style={labelStyle}>Qué se está vendiendo</label>
        <input
          id="title" name="title" required autoFocus={!editando} style={inputStyle}
          defaultValue={initial?.title}
          placeholder="Rediseño del sitio web"
        />
      </div>

      <div>
        <label htmlFor="account" style={labelStyle}>Cuenta</label>
        {editando || fixedAccountId ? (
          <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", padding: "0.55rem 0" }}>
            {cuenta?.name ?? "—"}
          </p>
        ) : (
          <select
            id="account" value={accountId} style={inputStyle}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label htmlFor="stage" style={labelStyle}>Etapa</label>
          <select id="stage" name="stage" defaultValue={initial?.stage ?? "NUEVA"} style={inputStyle}>
            {DEAL_STAGES.map((s) => <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="amount" style={labelStyle}>Valor estimado {opcional}</label>
          <input
            id="amount" name="amount" inputMode="numeric" style={inputStyle}
            defaultValue={initial?.amount ?? ""}
            placeholder="8000000"
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label htmlFor="expectedCloseAt" style={labelStyle}>Cierre esperado {opcional}</label>
          <input
            id="expectedCloseAt" name="expectedCloseAt" type="date" style={inputStyle}
            defaultValue={initial?.expectedCloseAt ?? ""}
          />
        </div>
        <div>
          <label htmlFor="ownerId" style={labelStyle}>Responsable {opcional}</label>
          <select id="ownerId" name="ownerId" defaultValue={initial?.ownerId ?? ""} style={inputStyle}>
            <option value="">Sin asignar</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="contactId" style={labelStyle}>Contacto {opcional}</label>
        <select id="contactId" name="contactId" defaultValue={initial?.contactId ?? ""} style={inputStyle}>
          <option value="">Sin contacto</option>
          {(cuenta?.contacts ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {cuenta && cuenta.contacts.length === 0 && (
          <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.3rem" }}>
            Esta cuenta todavía no tiene contactos.
          </p>
        )}
      </div>

      <div>
        <label htmlFor="notes" style={labelStyle}>Notas {opcional}</label>
        <textarea
          id="notes" name="notes" rows={3} style={{ ...inputStyle, resize: "vertical" }}
          defaultValue={initial?.notes ?? ""}
          placeholder="Alcance, condiciones, lo que haya que recordar…"
        />
      </div>

      {error && <p style={{ fontSize: "0.8125rem", color: "#b91c1c" }}>{error}</p>}
      {guardado && !error && <p style={{ fontSize: "0.8125rem", color: "#16a34a" }}>Cambios guardados.</p>}

      <button
        type="submit"
        disabled={isPending || !accountId}
        style={{
          alignSelf: "flex-start", backgroundColor: "#fd1384", color: "#fff",
          border: "none", borderRadius: "0.5rem", padding: "0.55rem 1.25rem",
          fontSize: "0.875rem", fontWeight: 500,
          cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? "Guardando..." : editando ? "Guardar cambios" : "Crear oportunidad"}
      </button>
    </form>
  );
}
