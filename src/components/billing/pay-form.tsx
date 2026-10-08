"use client";

import { useState } from "react";
import { startPayment } from "@/actions/paylink.actions";

/**
 * El formulario de la página pública de pago.
 *
 * Pide lo que Payments Way exige de quien paga y, al aceptar, envía al
 * navegador a su pasarela. Nace vacío a propósito: la página se abre con solo
 * tener el link, y rellenarla con el correo o el teléfono de un contacto sería
 * enseñárselos a quien sea que lo haya recibido reenviado.
 */

const TIPOS: { value: string; label: string }[] = [
  { value: "NIT", label: "NIT" },
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "PA", label: "Pasaporte" },
];

const input: React.CSSProperties = {
  width: "100%", padding: "0.6rem 0.75rem", fontSize: "0.9375rem",
  borderRadius: "0.5rem", border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
};
const label: React.CSSProperties = {
  display: "block", fontSize: "0.8125rem", fontWeight: 600,
  color: "var(--app-body-text)", marginBottom: "0.3rem",
};

/** Payments Way recibe el pago como un formulario enviado por el navegador. */
function enviarAPasarela(url: string, fields: Record<string, string>) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  for (const [name, value] of Object.entries(fields)) {
    const campo = document.createElement("input");
    campo.type = "hidden";
    campo.name = name;
    campo.value = value;
    form.appendChild(campo);
  }
  document.body.appendChild(form);
  form.submit();
}

export function PayForm({ token, importe }: { token: string; importe: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function pagar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    const f = new FormData(e.currentTarget);
    try {
      const r = await startPayment(token, {
        firstName: f.get("firstName"),
        lastName: f.get("lastName"),
        email: f.get("email"),
        phone: f.get("phone"),
        docType: f.get("docType"),
        docNumber: f.get("docNumber"),
      });
      if (!r.ok) {
        setError(r.error);
        setIsPending(false);
        return;
      }
      // Sin soltar el botón: la página se va a la pasarela.
      enviarAPasarela(r.form.url, r.form.fields);
    } catch {
      setError("No pudimos iniciar el pago. Inténtalo de nuevo.");
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={pagar} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
        Datos de quien paga
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))", gap: "0.85rem" }}>
        <div>
          <label htmlFor="pago-nombre" style={label}>Nombre</label>
          <input id="pago-nombre" name="firstName" required autoComplete="given-name" style={input} />
        </div>
        <div>
          <label htmlFor="pago-apellido" style={label}>Apellido</label>
          <input id="pago-apellido" name="lastName" required autoComplete="family-name" style={input} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))", gap: "0.85rem" }}>
        <div>
          <label htmlFor="pago-doc-tipo" style={label}>Tipo de documento</label>
          <select id="pago-doc-tipo" name="docType" defaultValue="NIT" style={input}>
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="pago-doc" style={label}>Número de documento</label>
          <input id="pago-doc" name="docNumber" required inputMode="numeric" style={input} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))", gap: "0.85rem" }}>
        <div>
          <label htmlFor="pago-correo" style={label}>Correo</label>
          <input id="pago-correo" name="email" type="email" required autoComplete="email" style={input} />
        </div>
        <div>
          <label htmlFor="pago-telefono" style={label}>Teléfono</label>
          <input id="pago-telefono" name="phone" type="tel" required autoComplete="tel" style={input} />
        </div>
      </div>

      {error && (
        <p role="alert" style={{ fontSize: "0.875rem", color: "#b91c1c", margin: 0 }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        style={{
          backgroundColor: "#fd1384", color: "#ffffff", border: "none", borderRadius: "0.5rem",
          padding: "0.8rem 1.25rem", fontSize: "1rem", fontWeight: 600,
          cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? "Abriendo la pasarela..." : `Pagar ${importe}`}
      </button>
      <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", margin: 0, textAlign: "center" }}>
        El pago se hace en la pasarela segura de Payments Way. Aquí no se pide ni se guarda ningún dato de tu tarjeta.
      </p>
    </form>
  );
}
