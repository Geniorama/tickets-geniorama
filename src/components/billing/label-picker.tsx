"use client";

import { useState, useTransition } from "react";
import { Plus, Check } from "lucide-react";
import { setBillingLabels, createBillingLabel } from "@/actions/billing-notes.actions";

/**
 * Las etiquetas de un cobro.
 *
 * Son una dimensión aparte de la columna: un cobro «Facturado» puede estar a la
 * vez «Por revisar». Por eso se marcan varias y no se elige una.
 *
 * La lista se puede ampliar aquí mismo. Si crear una etiqueta exigiera un
 * despliegue, la gente acabaría metiéndolas en el título del cobro.
 */

export type Etiqueta = { id: string; name: string; color: string };

const COLORES = ["#f59e0b", "#3b82f6", "#22c55e", "#8b5cf6", "#dc2626", "#64748b"];

export function LabelPicker({
  billingItemId,
  todas,
  puestas,
  canEdit,
  canCreate,
}: {
  billingItemId: string;
  todas: Etiqueta[];
  puestas: string[];
  canEdit: boolean;
  /** Crear etiquetas afecta a todo el módulo: solo GESTOR. */
  canCreate: boolean;
}) {
  const [seleccion, setSeleccion] = useState<string[]>(puestas);
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [color, setColor] = useState(COLORES[0]);
  const [disponibles, setDisponibles] = useState(todas);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function alternar(id: string) {
    const siguiente = seleccion.includes(id)
      ? seleccion.filter((x) => x !== id)
      : [...seleccion, id];

    // Se pinta al instante y se revierte si el servidor dice que no: marcar
    // una etiqueta debe sentirse inmediato.
    setSeleccion(siguiente);
    startTransition(async () => {
      const r = await setBillingLabels(billingItemId, siguiente);
      if (r?.error) {
        setSeleccion(seleccion);
        setError(r.error);
      }
    });
  }

  function crear() {
    const limpio = nombre.trim();
    if (!limpio) return;
    setError(null);
    startTransition(async () => {
      const r = await createBillingLabel(limpio, color);
      if (r?.error || !r?.id) return setError(r?.error ?? "No se pudo crear");

      setDisponibles((prev) =>
        prev.some((e) => e.id === r.id) ? prev : [...prev, { id: r.id!, name: limpio, color }],
      );
      // Recién creada se pone al cobro: es para lo que se estaba creando.
      const siguiente = [...seleccion, r.id];
      setSeleccion(siguiente);
      await setBillingLabels(billingItemId, siguiente);

      setNombre("");
      setCreando(false);
    });
  }

  return (
    <div>
      <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.45rem" }}>
        Etiquetas
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
        {disponibles.map((e) => {
          const activa = seleccion.includes(e.id);
          return (
            <button
              key={e.id}
              type="button"
              disabled={!canEdit || isPending}
              onClick={() => alternar(e.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.3rem",
                fontSize: "0.75rem", fontWeight: activa ? 700 : 500,
                padding: "0.25rem 0.6rem", borderRadius: "9999px",
                border: `1px solid ${activa ? e.color : "var(--app-border)"}`,
                backgroundColor: activa ? `${e.color}22` : "transparent",
                color: activa ? e.color : "var(--app-nav-text)",
                cursor: canEdit ? "pointer" : "default",
              }}
            >
              {activa && <Check style={{ width: "0.7rem", height: "0.7rem" }} />}
              {e.name}
            </button>
          );
        })}

        {canEdit && canCreate && !creando && (
          <button
            type="button"
            onClick={() => setCreando(true)}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.25rem",
              fontSize: "0.75rem", padding: "0.25rem 0.6rem", borderRadius: "9999px",
              border: "1px dashed var(--app-border)", background: "none",
              color: "var(--app-text-muted)", cursor: "pointer",
            }}
          >
            <Plus style={{ width: "0.7rem", height: "0.7rem" }} />
            Nueva
          </button>
        )}
      </div>

      {creando && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
          <input
            autoFocus
            value={nombre}
            onChange={(ev) => setNombre(ev.target.value)}
            placeholder="Nombre de la etiqueta"
            maxLength={40}
            style={{
              padding: "0.35rem 0.6rem", fontSize: "0.8125rem", width: "12rem",
              borderRadius: "0.45rem", border: "1px solid var(--app-border)",
              backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
            }}
          />
          <div style={{ display: "flex", gap: "0.2rem" }}>
            {COLORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                style={{
                  width: "1.1rem", height: "1.1rem", borderRadius: "9999px",
                  backgroundColor: c, cursor: "pointer",
                  border: color === c ? "2px solid var(--app-body-text)" : "1px solid var(--app-border)",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={crear}
            disabled={isPending || !nombre.trim()}
            style={{
              fontSize: "0.8125rem", padding: "0.35rem 0.7rem", borderRadius: "0.45rem",
              border: "none", backgroundColor: "#fd1384", color: "#fff", cursor: "pointer",
            }}
          >
            Crear
          </button>
          <button
            type="button"
            onClick={() => { setCreando(false); setNombre(""); setError(null); }}
            style={{
              fontSize: "0.8125rem", padding: "0.35rem 0.6rem", borderRadius: "0.45rem",
              border: "1px solid var(--app-border)", background: "none",
              color: "var(--app-text-muted)", cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      {error && <p style={{ fontSize: "0.75rem", color: "#b91c1c", marginTop: "0.4rem" }}>{error}</p>}
    </div>
  );
}
