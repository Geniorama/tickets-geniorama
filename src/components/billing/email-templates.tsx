"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { VARIABLES_CORREO } from "@/lib/billing/reminders/template";
import {
  createEmailTemplate, updateEmailTemplate, deleteEmailTemplate,
} from "@/actions/billing-emails.actions";

/**
 * Las plantillas de correo, escritas por quien le escribe al cliente.
 *
 * Aquí no se manda nada: una plantilla es solo el texto de partida. Se elige
 * desde la ficha de un cobro, y es allí donde se ve a quién va y cómo queda.
 */

export type Plantilla = {
  id: string;
  name: string;
  subject: string;
  body: string;
  onlyIfPending: boolean;
  enviados: number;
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

export function EmailTemplates({ plantillas }: { plantillas: Plantilla[] }) {
  const [editando, setEditando] = useState<Plantilla | null>(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function guardar(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r = editando
        ? await updateEmailTemplate(editando.id, formData)
        : await createEmailTemplate(formData);
      if (r?.error) return setError(r.error);
      setEditando(null);
      setCreando(false);
    });
  }

  function borrar(id: string) {
    startTransition(async () => {
      const r = await deleteEmailTemplate(id);
      if (r?.error) setError(r.error);
    });
  }

  const enFormulario = creando || editando !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {error && (
        <p style={{ fontSize: "0.8125rem", color: "#b91c1c", margin: 0 }}>{error}</p>
      )}

      {plantillas.length === 0 && !enFormulario && (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
          Todavía no hay plantillas. Crea la primera para poder mandar correos desde un cobro.
        </p>
      )}

      {plantillas.map((p) => (
        <div
          key={p.id}
          style={{
            backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
            borderRadius: "0.75rem", padding: "1rem 1.25rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "14rem" }}>
              <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)", margin: 0 }}>
                {p.name}
              </p>
              <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: "0.2rem 0 0" }}>
                {p.subject}
                {p.enviados > 0 && ` · ${p.enviados} enviado${p.enviados === 1 ? "" : "s"}`}
              </p>
              {p.onlyIfPending && (
                <span
                  style={{
                    display: "inline-block", marginTop: "0.5rem",
                    fontSize: "0.75rem", padding: "0.2rem 0.55rem", borderRadius: "9999px",
                    border: "1px solid var(--app-border)", color: "var(--app-nav-text)",
                  }}
                >
                  Solo si queda saldo pendiente
                </span>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                type="button" onClick={() => { setCreando(false); setEditando(p); setError(null); }}
                aria-label={`Editar ${p.name}`}
                style={{ background: "none", border: "none", padding: 0, color: "var(--app-text-muted)", cursor: "pointer", display: "inline-flex" }}
              >
                <Pencil style={{ width: "0.9rem", height: "0.9rem" }} />
              </button>
              <button
                type="button" onClick={() => borrar(p.id)} disabled={isPending}
                aria-label={`Eliminar ${p.name}`}
                style={{ background: "none", border: "none", padding: 0, color: "#dc2626", cursor: "pointer", display: "inline-flex" }}
              >
                <Trash2 style={{ width: "0.9rem", height: "0.9rem" }} />
              </button>
            </div>
          </div>

          {editando?.id === p.id && (
            <Formulario
              key={p.id}
              plantilla={p}
              onGuardar={guardar}
              onCancelar={() => setEditando(null)}
              isPending={isPending}
            />
          )}
        </div>
      ))}

      {creando ? (
        <div
          style={{
            backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
            borderRadius: "0.75rem", padding: "1rem 1.25rem",
          }}
        >
          <Formulario
            onGuardar={guardar}
            onCancelar={() => setCreando(false)}
            isPending={isPending}
          />
        </div>
      ) : (
        !editando && (
          <button
            type="button"
            onClick={() => { setCreando(true); setError(null); }}
            style={{
              alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: "0.4rem",
              backgroundColor: "#fd1384", color: "#fff", border: "none", borderRadius: "0.5rem",
              padding: "0.55rem 1rem", fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
            }}
          >
            <Plus style={{ width: "1rem", height: "1rem" }} />
            Nueva plantilla
          </button>
        )
      )}
    </div>
  );
}

/** Las marcas disponibles, a la vista de quien escribe. */
export function Marcas() {
  return (
    <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
      {VARIABLES_CORREO.map((v) => (
        <span
          key={v.marca}
          title={v.descripcion}
          style={{
            fontSize: "0.7rem", fontFamily: "ui-monospace, monospace",
            padding: "0.15rem 0.45rem", borderRadius: "0.35rem",
            border: "1px solid var(--app-border)", color: "var(--app-text-muted)",
          }}
        >
          {`{{${v.marca}}}`}
        </span>
      ))}
    </div>
  );
}

function Formulario({
  plantilla,
  onGuardar,
  onCancelar,
  isPending,
}: {
  plantilla?: Plantilla;
  onGuardar: (fd: FormData) => void;
  onCancelar: () => void;
  isPending: boolean;
}) {
  const sufijo = plantilla?.id ?? "nueva";

  return (
    <form
      action={onGuardar}
      style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: plantilla ? "1rem" : 0 }}
    >
      <div>
        <label htmlFor={`name-${sufijo}`} style={labelStyle}>Nombre de la plantilla</label>
        <input
          id={`name-${sufijo}`} name="name" required style={inputStyle}
          defaultValue={plantilla?.name}
          placeholder="Pago recibido"
        />
      </div>

      <div>
        <label htmlFor={`subject-${sufijo}`} style={labelStyle}>Asunto del correo</label>
        <input
          id={`subject-${sufijo}`} name="subject" required style={inputStyle}
          defaultValue={plantilla?.subject}
          placeholder="Recibimos tu pago — {{concepto}}"
        />
      </div>

      <div>
        <label htmlFor={`body-${sufijo}`} style={labelStyle}>Mensaje</label>
        <textarea
          id={`body-${sufijo}`} name="body" required rows={8}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
          defaultValue={plantilla?.body}
          placeholder={"Hola {{contacto}},\n\nRecibimos tu pago de {{ultimo_abono}} el {{fecha_abono}}…"}
        />
        <Marcas />
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.45rem", fontSize: "0.8125rem", color: "var(--app-nav-text)" }}>
        <input type="checkbox" name="onlyIfPending" defaultChecked={plantilla?.onlyIfPending ?? false} style={{ marginTop: "0.2rem" }} />
        <span>
          Solo si queda saldo pendiente
          <span style={{ color: "var(--app-text-muted)" }}>
            {" "}— para las de cobranza: si se programa y el cliente paga antes, no sale.
          </span>
        </span>
      </label>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button
          type="submit" disabled={isPending}
          style={{
            backgroundColor: "#fd1384", color: "#fff", border: "none", borderRadius: "0.5rem",
            padding: "0.5rem 1.1rem", fontSize: "0.875rem", fontWeight: 500,
            cursor: isPending ? "wait" : "pointer", opacity: isPending ? 0.6 : 1,
          }}
        >
          {isPending ? "Guardando..." : plantilla ? "Guardar cambios" : "Crear plantilla"}
        </button>
        <button
          type="button" onClick={onCancelar}
          style={{
            background: "none", border: "1px solid var(--app-border)", borderRadius: "0.5rem",
            padding: "0.5rem 0.9rem", fontSize: "0.875rem", color: "var(--app-text-muted)", cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
