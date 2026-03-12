"use client";

import { useState, useTransition } from "react";
import { createVaultEntry, updateVaultEntry } from "@/actions/vault.actions";
import { Eye, EyeOff } from "lucide-react";

interface Company  { id: string; name: string; }
interface Site     { id: string; name: string; domain: string; companyId: string; }
interface Service  { id: string; name: string; type: string; companyId: string; }

interface VaultEntry {
  id: string; title: string; username: string | null; password: string;
  url: string | null; notes: string | null;
  companyId: string | null; siteId: string | null; serviceId: string | null;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  DOMINIO: "Dominio", HOSTING: "Hosting", CORREO: "Correo",
  SSL: "SSL", MANTENIMIENTO: "Mantenimiento", OTRO: "Otro",
};

interface VaultFormProps {
  companies: Company[];
  sites: Site[];
  services: Service[];
  entry?: VaultEntry;
  decryptedPassword?: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%", border: "1px solid var(--app-border)", borderRadius: "0.5rem",
  padding: "0.5rem 0.75rem", fontSize: "0.875rem", color: "var(--app-body-text)",
  backgroundColor: "var(--app-input-bg)", outline: "none", boxSizing: "border-box",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.875rem", fontWeight: 500,
  color: "var(--app-body-text)", marginBottom: "0.25rem",
};

export function VaultForm({ companies, sites, services, entry, decryptedPassword }: VaultFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState(entry?.companyId ?? "");
  const isEdit = !!entry;

  const filteredSites = selectedCompanyId
    ? sites.filter((s) => s.companyId === selectedCompanyId)
    : sites;
  const filteredServices = selectedCompanyId
    ? services.filter((s) => s.companyId === selectedCompanyId)
    : services;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = isEdit
        ? await updateVaultEntry(entry.id, formData)
        : await createVaultEntry(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div>
        <label style={labelStyle}>Título *</label>
        <input name="title" required defaultValue={entry?.title ?? ""} placeholder="Ej: cPanel producción" style={inputStyle} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Usuario / Email</label>
          <input name="username" defaultValue={entry?.username ?? ""} placeholder="usuario@ejemplo.com" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Contraseña *</label>
          <div style={{ position: "relative" }}>
            <input
              name="password"
              required
              type={showPassword ? "text" : "password"}
              defaultValue={decryptedPassword ?? ""}
              placeholder="••••••••"
              style={{ ...inputStyle, paddingRight: "2.5rem" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{
                position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "var(--app-text-muted)",
                display: "flex", alignItems: "center",
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div>
        <label style={labelStyle}>URL</label>
        <input name="url" type="url" defaultValue={entry?.url ?? ""} placeholder="https://..." style={inputStyle} />
      </div>

      <div>
        <label style={labelStyle}>Empresa</label>
        <select
          name="companyId"
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(e.target.value)}
          style={inputStyle}
        >
          <option value="">Sin empresa</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <div>
          <label style={labelStyle}>Sitio / App</label>
          <select name="siteId" defaultValue={entry?.siteId ?? ""} style={inputStyle}
            disabled={!selectedCompanyId && sites.length === 0}>
            <option value="">Sin sitio</option>
            {filteredSites.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.domain}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Servicio</label>
          <select name="serviceId" defaultValue={entry?.serviceId ?? ""} style={inputStyle}
            disabled={!selectedCompanyId && services.length === 0}>
            <option value="">Sin servicio</option>
            {filteredServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({SERVICE_TYPE_LABELS[s.type] ?? s.type})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Notas</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={entry?.notes ?? ""}
          placeholder="Información adicional..."
          style={inputStyle}
        />
      </div>

      {error && (
        <p style={{
          fontSize: "0.875rem", color: "#b91c1c", backgroundColor: "#fef2f2",
          border: "1px solid #fecaca", borderRadius: "0.5rem", padding: "0.625rem 0.75rem",
        }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", paddingTop: "0.5rem" }}>
        <button type="button" onClick={() => history.back()} style={{
          padding: "0.5rem 1rem", fontSize: "0.875rem", color: "var(--app-text-muted)",
          background: "none", border: "none", cursor: "pointer",
        }}>
          Cancelar
        </button>
        <button type="submit" disabled={isPending} style={{
          backgroundColor: "#fd1384", color: "#ffffff", padding: "0.5rem 1.25rem",
          borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 500,
          border: "none", cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
        }}>
          {isPending ? (isEdit ? "Guardando..." : "Creando...") : (isEdit ? "Guardar cambios" : "Crear entrada")}
        </button>
      </div>
    </form>
  );
}
