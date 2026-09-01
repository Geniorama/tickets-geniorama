"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, Mail, MessageSquare, Phone } from "lucide-react";
import type { ReminderChannel } from "@/generated/prisma";
import { VARIABLES } from "@/lib/billing/reminders/template";
import { CHANNEL_LABELS } from "@/lib/billing/reminders/labels";
import {
  createReminderRule, updateReminderRule, toggleReminderRule, deleteReminderRule,
} from "@/actions/billing-reminders.actions";

/**
 * Las reglas de cobro, escritas por quien cobra.
 *
 * La pantalla insiste en dos cosas porque son las que se olvidan y las que
 * duelen: **cuándo** sale respecto al vencimiento, y que un canal sin conectar
 * no manda nada aunque esté marcado.
 */

export type Regla = {
  id: string;
  name: string;
  offsetDays: number;
  channels: ReminderChannel[];
  subject: string;
  body: string;
  isActive: boolean;
  enviados: number;
};

const ICONOS: Record<ReminderChannel, typeof Mail> = {
  EMAIL: Mail, SMS: MessageSquare, WHATSAPP: Phone,
};
const NOMBRES = CHANNEL_LABELS;

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.55rem 0.75rem", fontSize: "0.875rem",
  borderRadius: "0.5rem", border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.8125rem", fontWeight: 600,
  color: "var(--app-body-text)", marginBottom: "0.3rem",
};

/** «a los 3 días del vencimiento», «3 días antes», «el mismo día». */
export function cuando(offsetDays: number): string {
  if (offsetDays === 0) return "El día del vencimiento";
  const n = Math.abs(offsetDays);
  const dias = n === 1 ? "1 día" : `${n} días`;
  return offsetDays > 0 ? `${dias} después del vencimiento` : `${dias} antes del vencimiento`;
}

export function ReminderRules({
  reglas,
  canalesListos,
}: {
  reglas: Regla[];
  /** Los que el servidor puede mandar de verdad hoy. */
  canalesListos: ReminderChannel[];
}) {
  const [editando, setEditando] = useState<Regla | null>(null);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function guardar(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const r = editando
        ? await updateReminderRule(editando.id, formData)
        : await createReminderRule(formData);
      if (r?.error) return setError(r.error);
      setEditando(null);
      setCreando(false);
    });
  }

  function alternar(regla: Regla) {
    startTransition(async () => {
      const r = await toggleReminderRule(regla.id, !regla.isActive);
      if (r?.error) setError(r.error);
    });
  }

  function borrar(id: string) {
    startTransition(async () => {
      const r = await deleteReminderRule(id);
      if (r?.error) setError(r.error);
    });
  }

  const enFormulario = creando || editando !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {error && (
        <p style={{ fontSize: "0.8125rem", color: "#b91c1c", margin: 0 }}>{error}</p>
      )}

      {reglas.length === 0 && !enFormulario && (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
          Todavía no hay reglas. Mientras no haya ninguna activa, no sale nada.
        </p>
      )}

      {reglas.map((regla) => (
        <div
          key={regla.id}
          style={{
            backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
            borderRadius: "0.75rem", padding: "1rem 1.25rem",
            opacity: regla.isActive ? 1 : 0.6,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "14rem" }}>
              <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)", margin: 0 }}>
                {regla.name}
              </p>
              <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: "0.2rem 0 0" }}>
                {cuando(regla.offsetDays)}
                {regla.enviados > 0 && ` · ${regla.enviados} enviado${regla.enviados === 1 ? "" : "s"}`}
              </p>

              <div style={{ display: "flex", gap: "0.35rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                {regla.channels.map((c) => {
                  const Icono = ICONOS[c];
                  const listo = canalesListos.includes(c);
                  return (
                    <span
                      key={c}
                      title={listo ? undefined : `${NOMBRES[c]} no está conectado: se registra pero no sale`}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "0.3rem",
                        fontSize: "0.75rem", padding: "0.2rem 0.55rem", borderRadius: "9999px",
                        border: `1px ${listo ? "solid" : "dashed"} var(--app-border)`,
                        color: listo ? "var(--app-nav-text)" : "var(--app-text-muted)",
                      }}
                    >
                      <Icono style={{ width: "0.7rem", height: "0.7rem" }} />
                      {NOMBRES[c]}
                      {!listo && " · sin conectar"}
                    </span>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => alternar(regla)}
                disabled={isPending}
                style={{
                  fontSize: "0.75rem", padding: "0.3rem 0.7rem", borderRadius: "9999px",
                  border: `1px solid ${regla.isActive ? "#22c55e" : "var(--app-border)"}`,
                  backgroundColor: regla.isActive ? "#22c55e22" : "transparent",
                  color: regla.isActive ? "#22c55e" : "var(--app-text-muted)",
                  cursor: "pointer", fontWeight: 600,
                }}
              >
                {regla.isActive ? "Activa" : "Apagada"}
              </button>
              <button
                type="button" onClick={() => { setCreando(false); setEditando(regla); setError(null); }}
                aria-label={`Editar ${regla.name}`}
                style={{ background: "none", border: "none", padding: 0, color: "var(--app-text-muted)", cursor: "pointer", display: "inline-flex" }}
              >
                <Pencil style={{ width: "0.9rem", height: "0.9rem" }} />
              </button>
              <button
                type="button" onClick={() => borrar(regla.id)} disabled={isPending}
                aria-label={`Eliminar ${regla.name}`}
                style={{ background: "none", border: "none", padding: 0, color: "#dc2626", cursor: "pointer", display: "inline-flex" }}
              >
                <Trash2 style={{ width: "0.9rem", height: "0.9rem" }} />
              </button>
            </div>
          </div>

          {editando?.id === regla.id && (
            <Formulario
              key={regla.id}
              regla={regla}
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
            Nueva regla
          </button>
        )
      )}
    </div>
  );
}

function Formulario({
  regla,
  onGuardar,
  onCancelar,
  isPending,
}: {
  regla?: Regla;
  onGuardar: (fd: FormData) => void;
  onCancelar: () => void;
  isPending: boolean;
}) {
  // El valor se guarda como texto y no como número. Un `<input type="number">`
  // controlado con un número no deja teclear «-5»: al pulsar el signo el campo
  // vale "" por un instante, `Number("")` es 0, y el usuario acaba con «05».
  // Con texto, el guion sobrevive mientras se escribe.
  const [dias, setDias] = useState(String(regla?.offsetDays ?? 3));
  const n = Number(dias);

  return (
    <form
      action={onGuardar}
      style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: regla ? "1rem" : 0 }}
    >
      <div>
        <label htmlFor={`name-${regla?.id ?? "nueva"}`} style={labelStyle}>Nombre de la regla</label>
        <input
          id={`name-${regla?.id ?? "nueva"}`} name="name" required style={inputStyle}
          defaultValue={regla?.name}
          placeholder="Primer aviso"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label htmlFor={`offset-${regla?.id ?? "nueva"}`} style={labelStyle}>Días</label>
          <input
            id={`offset-${regla?.id ?? "nueva"}`} name="offsetDays" type="number" required
            style={inputStyle} min={-90} max={365}
            value={dias}
            onChange={(e) => setDias(e.target.value)}
          />
          <p style={{ fontSize: "0.7rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
            {dias.trim() === "" || !Number.isFinite(n)
              ? "Escribe los días respecto al vencimiento."
              : `${cuando(n)}.`}{" "}
            En negativo, avisa antes de que venza.
          </p>
        </div>
        <div>
          <span style={labelStyle}>Canales</span>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem", paddingTop: "0.2rem" }}>
            {(["EMAIL", "SMS", "WHATSAPP"] as ReminderChannel[]).map((c) => (
              <label key={c} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8125rem", color: "var(--app-nav-text)" }}>
                <input
                  type="checkbox" name="channels" value={c}
                  defaultChecked={regla ? regla.channels.includes(c) : c === "EMAIL"}
                />
                {NOMBRES[c]}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label htmlFor={`subject-${regla?.id ?? "nueva"}`} style={labelStyle}>Asunto del correo</label>
        <input
          id={`subject-${regla?.id ?? "nueva"}`} name="subject" required style={inputStyle}
          defaultValue={regla?.subject}
          placeholder="Factura {{factura}} pendiente"
        />
      </div>

      <div>
        <label htmlFor={`body-${regla?.id ?? "nueva"}`} style={labelStyle}>Mensaje</label>
        <textarea
          id={`body-${regla?.id ?? "nueva"}`} name="body" required rows={7}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
          defaultValue={regla?.body}
          placeholder={"Hola {{contacto}},\n\nLa factura {{factura}} por {{pendiente}} venció el {{vencimiento}}…"}
        />
        <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
          {VARIABLES.map((v) => (
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
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.8125rem", color: "var(--app-nav-text)" }}>
        <input type="checkbox" name="isActive" defaultChecked={regla?.isActive ?? false} />
        Activa
        <span style={{ color: "var(--app-text-muted)" }}>
          — al encenderla empieza a contar desde hoy, no reclama lo atrasado.
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
          {isPending ? "Guardando..." : regla ? "Guardar cambios" : "Crear regla"}
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
