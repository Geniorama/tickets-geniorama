"use client";

import { useState, useTransition } from "react";
import { createService, updateService } from "@/actions/service.actions";

interface Company { id: string; name: string }
interface Service {
  id: string; name: string; type: string; provider: string;
  description: string | null; dueDate: Date | null;
  price: number | null; notes: string | null;
  isActive: boolean; companyId: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%", border: "1px solid var(--app-border)", borderRadius: "0.5rem",
  padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: "var(--app-body-text)",
  backgroundColor: "var(--app-card-bg)", outline: "none", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.875rem", fontWeight: 500,
  color: "var(--app-body-text)", marginBottom: "0.25rem",
};

const SERVICE_TYPES = [
  { value: "DOMINIO",        label: "Dominio" },
  { value: "HOSTING",        label: "Hosting" },
  { value: "CORREO",         label: "Correos" },
  { value: "SSL",            label: "SSL" },
  { value: "MANTENIMIENTO",  label: "Mantenimiento" },
  { value: "OTRO",           label: "Otro" },
];

export function ServiceForm({
  companies,
  service,
  defaultCompanyId,
}: {
  companies: Company[];
  service?: Service;
  defaultCompanyId?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState(service?.provider ?? "GENIORAMA");
  const isEdit = !!service;

  const toInputDate = (d: Date | null | undefined) => {
    if (!d) return "";
    return new Date(d).toISOString().split("T")[0];
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = isEdit
        ? await updateService(service.id, formData)
        : await createService(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Empresa</label>
          <select name="companyId" defaultValue={service?.companyId ?? defaultCompanyId ?? ""} required style={inputStyle}>
            <option value="">Seleccionar empresa…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Tipo de servicio</label>
          <select name="type" defaultValue={service?.type ?? "DOMINIO"} required style={inputStyle}>
            {SERVICE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Nombre / Identificador</label>
        <input
          name="name" required
          defaultValue={service?.name ?? ""}
          placeholder="ej. midominio.com, Plan Business, info@empresa.com"
          style={inputStyle}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Prestador</label>
          <select
            name="provider"
            defaultValue={service?.provider ?? "GENIORAMA"}
            onChange={(e) => setProvider(e.target.value)}
            style={inputStyle}
          >
            <option value="GENIORAMA">Geniorama</option>
            <option value="EXTERNO">Externo</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Fecha de vencimiento</label>
          <input name="dueDate" type="date" defaultValue={toInputDate(service?.dueDate)} style={inputStyle} />
        </div>
      </div>

      {provider === "GENIORAMA" && (
        <div>
          <label style={labelStyle}>
            Precio{" "}
            <span style={{ color: "var(--app-text-muted)", fontWeight: 400 }}>(COP, opcional)</span>
          </label>
          <input
            name="price" type="number" min="0" step="1000"
            defaultValue={service?.price ?? ""}
            placeholder="0"
            style={inputStyle}
          />
        </div>
      )}

      <div>
        <label style={labelStyle}>Descripción <span style={{ color: "var(--app-text-muted)", fontWeight: 400 }}>(opcional)</span></label>
        <textarea
          name="description" rows={2}
          defaultValue={service?.description ?? ""}
          placeholder="Detalles visibles para el cliente…"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Notas internas <span style={{ color: "var(--app-text-muted)", fontWeight: 400 }}>(solo equipo)</span></label>
        <textarea
          name="notes" rows={2}
          defaultValue={service?.notes ?? ""}
          placeholder="Credenciales, accesos, observaciones…"
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          type="checkbox" id="isActive" name="isActive" value="true"
          defaultChecked={service?.isActive ?? true}
          style={{ width: "1rem", height: "1rem", accentColor: "#fd1384" }}
        />
        <label htmlFor="isActive" style={{ ...labelStyle, margin: 0 }}>Servicio activo</label>
      </div>

      {error && (
        <p style={{ fontSize: "0.875rem", color: "#b91c1c", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.625rem 0.75rem" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem" }}>
        <button type="button" onClick={() => history.back()}
          style={{ padding: "0.5rem 1rem", fontSize: "0.875rem", color: "var(--app-text-muted)", background: "none", border: "none", cursor: "pointer" }}>
          Cancelar
        </button>
        <button type="submit" disabled={isPending}
          style={{ backgroundColor: "#fd1384", color: "#ffffff", padding: "0.5rem 1.25rem", borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 500, border: "none", cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1 }}>
          {isPending ? (isEdit ? "Guardando…" : "Creando…") : (isEdit ? "Guardar cambios" : "Crear servicio")}
        </button>
      </div>
    </form>
  );
}
