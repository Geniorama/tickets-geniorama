"use client";

import { useState, useTransition } from "react";
import { Plus, X, Receipt } from "lucide-react";
import { setBillingEmails } from "@/actions/billing-reminders.actions";

/**
 * Los correos a los que se le reclaman los cobros a este cliente.
 *
 * Existe porque el buzón de facturación casi nunca es una persona del CRM:
 * es `facturacion@cliente.com`, o el correo de su contador, o los dos. Obligar
 * a darlos de alta como contactos llenaría la agenda de buzones sin nombre.
 *
 * Mientras esté vacío, los recordatorios van al contacto principal. La pantalla
 * lo dice, porque «vacío» aquí no significa «no se avisa a nadie».
 */
export function BillingEmails({
  companyId,
  iniciales,
  contactoPrincipal,
  canEdit,
}: {
  companyId: string;
  iniciales: string[];
  /** A quién le llegaría hoy si esto se deja vacío. */
  contactoPrincipal: string | null;
  canEdit: boolean;
}) {
  const [correos, setCorreos] = useState<string[]>(iniciales);
  const [nuevo, setNuevo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [isPending, startTransition] = useTransition();

  function guardar(siguiente: string[]) {
    const previos = correos;
    setCorreos(siguiente);
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const r = await setBillingEmails(companyId, siguiente);
      if (r?.error) {
        setCorreos(previos);
        return setError(r.error);
      }
      setGuardado(true);
    });
  }

  function anadir() {
    const limpio = nuevo.trim().toLowerCase();
    if (!limpio) return;
    if (correos.includes(limpio)) {
      setNuevo("");
      return setError("Ese correo ya está en la lista");
    }
    setNuevo("");
    guardar([...correos, limpio]);
  }

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
        borderRadius: "0.75rem", padding: "1.25rem", marginTop: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.3rem" }}>
        <Receipt style={{ width: "0.95rem", height: "0.95rem", color: "var(--app-icon-color)" }} />
        <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)", margin: 0 }}>
          Correos de facturación
        </h2>
      </div>

      <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: "0 0 0.85rem" }}>
        {correos.length > 0
          ? "Los recordatorios de cobro van a estos correos."
          : contactoPrincipal
            ? `Sin correos aquí, los recordatorios van al contacto principal: ${contactoPrincipal}.`
            : "Sin correos aquí y sin contacto principal marcado, no saldrá ningún recordatorio."}
      </p>

      {correos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.75rem" }}>
          {correos.map((c) => (
            <span
              key={c}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                fontSize: "0.8125rem", padding: "0.25rem 0.6rem", borderRadius: "9999px",
                border: "1px solid var(--app-border)", color: "var(--app-nav-text)",
              }}
            >
              {c}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => guardar(correos.filter((x) => x !== c))}
                  disabled={isPending}
                  aria-label={`Quitar ${c}`}
                  style={{ background: "none", border: "none", padding: 0, color: "#dc2626", cursor: "pointer", display: "inline-flex" }}
                >
                  <X style={{ width: "0.7rem", height: "0.7rem" }} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {canEdit && (
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          <input
            type="email"
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); anadir(); } }}
            placeholder="facturacion@cliente.com"
            style={{
              flex: 1, minWidth: "14rem", padding: "0.5rem 0.7rem", fontSize: "0.8125rem",
              borderRadius: "0.5rem", border: "1px solid var(--app-border)",
              backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
            }}
          />
          <button
            type="button"
            onClick={anadir}
            disabled={isPending || !nuevo.trim()}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.3rem",
              fontSize: "0.8125rem", padding: "0.5rem 0.85rem", borderRadius: "0.5rem",
              border: "none", backgroundColor: "#fd1384", color: "#fff",
              cursor: isPending ? "wait" : "pointer", opacity: isPending || !nuevo.trim() ? 0.6 : 1,
            }}
          >
            <Plus style={{ width: "0.85rem", height: "0.85rem" }} />
            Añadir
          </button>
        </div>
      )}

      {error && <p style={{ fontSize: "0.75rem", color: "#b91c1c", marginTop: "0.5rem" }}>{error}</p>}
      {guardado && !error && (
        <p style={{ fontSize: "0.75rem", color: "#16a34a", marginTop: "0.5rem" }}>Guardado.</p>
      )}
    </div>
  );
}
