"use client";

import { useState, useTransition } from "react";
import { Mail, Phone, Star, Trash2, Plus, X } from "lucide-react";
import { createContact, deleteContact } from "@/actions/crm.actions";

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  isPrimary: boolean;
};

/**
 * Contactos de una cuenta. El alta va en línea, sin salir de la ficha: en un
 * CRM se apuntan mientras se habla con la persona.
 */
export function ContactList({
  accountId,
  contacts,
  canEdit,
}: {
  accountId: string;
  contacts: Contact[];
  canEdit: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createContact(accountId, formData);
      if (result?.error) setError(result.error);
      else setAdding(false);
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar a ${name} de los contactos?`)) return;
    startTransition(async () => { await deleteContact(id, accountId); });
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.5rem 0.7rem", fontSize: "0.875rem",
    borderRadius: "0.5rem", border: "1px solid var(--app-border)",
    backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
  };

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
        borderRadius: "0.75rem", padding: "1.25rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)" }}>
          Contactos ({contacts.length})
        </h2>
        {canEdit && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.3rem",
              fontSize: "0.8125rem", fontWeight: 500, color: "#fd1384",
              background: "none", border: "none", cursor: "pointer", padding: 0,
            }}
          >
            <Plus style={{ width: "0.9rem", height: "0.9rem" }} />
            Añadir
          </button>
        )}
      </div>

      {adding && (
        <form action={handleCreate} style={{ marginBottom: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <input name="name" placeholder="Nombre y apellidos" required style={inputStyle} autoFocus />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <input name="email" type="email" placeholder="Correo (opcional)" style={inputStyle} />
            <input name="phone" placeholder="Teléfono (opcional)" style={inputStyle} />
          </div>
          <input name="position" placeholder="Cargo (opcional)" style={inputStyle} />
          <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.8125rem", color: "var(--app-nav-text)" }}>
            <input type="checkbox" name="isPrimary" value="true" />
            Contacto principal
          </label>

          {error && <p style={{ fontSize: "0.8125rem", color: "#b91c1c" }}>{error}</p>}

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="submit"
              disabled={isPending}
              style={{
                backgroundColor: "#fd1384", color: "#fff", border: "none",
                borderRadius: "0.5rem", padding: "0.45rem 1rem", fontSize: "0.8125rem",
                fontWeight: 500, cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1,
              }}
            >
              {isPending ? "Guardando..." : "Guardar contacto"}
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setError(null); }}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.3rem",
                background: "none", border: "1px solid var(--app-border)",
                borderRadius: "0.5rem", padding: "0.45rem 0.8rem",
                fontSize: "0.8125rem", color: "var(--app-text-muted)", cursor: "pointer",
              }}
            >
              <X style={{ width: "0.85rem", height: "0.85rem" }} />
              Cancelar
            </button>
          </div>
        </form>
      )}

      {contacts.length === 0 && !adding ? (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
          Sin contactos todavía.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {contacts.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex", alignItems: "flex-start", gap: "0.75rem",
                padding: "0.7rem 0.85rem", borderRadius: "0.6rem",
                border: "1px solid var(--app-border)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)" }}>
                    {c.name}
                  </span>
                  {c.isPrimary && (
                    <span title="Contacto principal" style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", fontSize: "0.6875rem", color: "#f59e0b" }}>
                      <Star style={{ width: "0.7rem", height: "0.7rem", fill: "#f59e0b" }} />
                      Principal
                    </span>
                  )}
                  {c.position && (
                    <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>· {c.position}</span>
                  )}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.25rem" }}>
                  {c.email && (
                    <a href={`mailto:${c.email}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "#fd1384", textDecoration: "none" }}>
                      <Mail style={{ width: "0.75rem", height: "0.75rem" }} />
                      {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--app-text-muted)", textDecoration: "none" }}>
                      <Phone style={{ width: "0.75rem", height: "0.75rem" }} />
                      {c.phone}
                    </a>
                  )}
                </div>
              </div>

              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(c.id, c.name)}
                  disabled={isPending}
                  aria-label={`Eliminar a ${c.name}`}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: "0.15rem", flexShrink: 0 }}
                >
                  <Trash2 style={{ width: "0.9rem", height: "0.9rem" }} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
