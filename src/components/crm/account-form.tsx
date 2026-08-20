"use client";

import { useState, useTransition } from "react";
import { createAccount } from "@/actions/crm.actions";
import { ACCOUNT_STAGES, ACCOUNT_STAGE_DESCRIPTIONS, ACCOUNT_STAGE_LABELS } from "@/lib/crm/accounts";

export function AccountForm({ owners }: { owners: { id: string; name: string }[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createAccount(formData);
      if (result?.error) setError(result.error);
    });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.55rem 0.75rem", fontSize: "0.875rem",
    borderRadius: "0.5rem", border: "1px solid var(--app-border)",
    backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "0.8125rem", fontWeight: 600,
    color: "var(--app-body-text)", marginBottom: "0.3rem",
  };

  return (
    <form
      action={handleSubmit}
      style={{
        backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
        borderRadius: "0.75rem", padding: "1.5rem",
        display: "flex", flexDirection: "column", gap: "1rem",
      }}
    >
      <div>
        <label htmlFor="name" style={labelStyle}>Nombre de la empresa</label>
        <input id="name" name="name" required autoFocus style={inputStyle} placeholder="Acme S.A.S." />
      </div>

      <div>
        <label style={labelStyle}>Etapa</label>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {ACCOUNT_STAGES.filter((s) => s !== "INACTIVO").map((stage, i) => (
            <label
              key={stage}
              style={{
                display: "flex", alignItems: "flex-start", gap: "0.55rem",
                padding: "0.6rem 0.75rem", borderRadius: "0.5rem",
                border: "1px solid var(--app-border)", cursor: "pointer",
              }}
            >
              <input type="radio" name="stage" value={stage} defaultChecked={i === 0} style={{ marginTop: "0.15rem" }} />
              <span>
                <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)" }}>
                  {ACCOUNT_STAGE_LABELS[stage]}
                </span>
                <span style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                  {ACCOUNT_STAGE_DESCRIPTIONS[stage]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label htmlFor="ownerId" style={labelStyle}>
            Responsable <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(opcional)</span>
          </label>
          <select id="ownerId" name="ownerId" defaultValue="" style={inputStyle}>
            <option value="">Sin asignar</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="source" style={labelStyle}>
            Origen <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(opcional)</span>
          </label>
          <input id="source" name="source" style={inputStyle} placeholder="Referido, web, evento…" />
        </div>
      </div>

      <div>
        <label htmlFor="taxId" style={labelStyle}>
          NIT <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(opcional)</span>
        </label>
        <input id="taxId" name="taxId" style={inputStyle} />
      </div>

      {error && <p style={{ fontSize: "0.8125rem", color: "#b91c1c" }}>{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        style={{
          alignSelf: "flex-start", backgroundColor: "#fd1384", color: "#fff",
          border: "none", borderRadius: "0.5rem", padding: "0.55rem 1.25rem",
          fontSize: "0.875rem", fontWeight: 500,
          cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? "Creando..." : "Crear cuenta"}
      </button>
    </form>
  );
}
