"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContact } from "@/actions/crm.actions";

/**
 * Alta de un contacto eligiendo la cuenta.
 *
 * El formulario en línea de la ficha sirve cuando ya estás dentro de la
 * empresa. Este es para cuando llegas al revés: tienes a la persona y hay que
 * decir de qué cuenta es.
 */
export function StandaloneContactForm({
  accounts,
  defaultAccountId,
}: {
  accounts: { id: string; name: string }[];
  defaultAccountId?: string;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(defaultAccountId ?? accounts[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createContact(accountId, formData);
      if (result?.error) setError(result.error);
      // Se vuelve a la ficha de la cuenta: es donde se sigue trabajando con
      // esa persona, no en el listado del que se venía.
      else router.push(`/crm/${accountId}`);
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
  const opcional = <span style={{ fontWeight: 400, color: "var(--app-text-muted)" }}>(opcional)</span>;

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
        <label htmlFor="accountId" style={labelStyle}>Cuenta</label>
        <select
          id="accountId" value={accountId} style={inputStyle}
          onChange={(e) => setAccountId(e.target.value)}
        >
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label htmlFor="firstName" style={labelStyle}>Nombre</label>
          <input id="firstName" name="firstName" required autoFocus style={inputStyle} placeholder="Ana" />
        </div>
        <div>
          <label htmlFor="lastName" style={labelStyle}>Apellidos {opcional}</label>
          <input id="lastName" name="lastName" style={inputStyle} placeholder="Pérez Gómez" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label htmlFor="email" style={labelStyle}>Correo {opcional}</label>
          <input id="email" name="email" type="email" style={inputStyle} placeholder="ana@empresa.co" />
        </div>
        <div>
          <label htmlFor="phone" style={labelStyle}>Teléfono {opcional}</label>
          <input id="phone" name="phone" style={inputStyle} />
        </div>
      </div>

      <div>
        <label htmlFor="position" style={labelStyle}>Cargo {opcional}</label>
        <input id="position" name="position" style={inputStyle} placeholder="Directora de marketing" />
      </div>

      <div>
        <label htmlFor="notes" style={labelStyle}>Notas {opcional}</label>
        <textarea id="notes" name="notes" rows={3} style={{ ...inputStyle, resize: "vertical" }} />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.8125rem", color: "var(--app-nav-text)" }}>
        <input type="checkbox" name="isPrimary" value="true" />
        Contacto principal de la cuenta
      </label>

      <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", margin: 0 }}>
        Con el correo puesto, después se le puede dar acceso al portal desde la ficha de la cuenta.
      </p>

      {error && <p style={{ fontSize: "0.8125rem", color: "#b91c1c" }}>{error}</p>}

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
        {isPending ? "Guardando..." : "Crear contacto"}
      </button>
    </form>
  );
}
