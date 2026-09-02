"use client";

/**
 * Borrar una tarjeta desde el tablero.
 *
 * Vive en la esquina de la tarjeta, junto al asa de arrastrar, y solo aparece
 * al pasar por encima: es una acción destructiva y no debe competir por la
 * atención con lo que se viene a hacer al tablero, que es mover cosas.
 *
 * Tres cuidados que no son opcionales aquí:
 *
 *   · **Para el clic.** La tarjeta entera es un enlace a la ficha; sin
 *     `preventDefault` y `stopPropagation`, pulsar la papelera navegaría en vez
 *     de borrar.
 *   · **Confirma siempre**, y diciendo qué se borra por su nombre. En un
 *     tablero las tarjetas están pegadas y se falla el clic.
 *   · **Enseña el error.** Si el servidor se niega —un cobro con abonos, un
 *     permiso que faltaba— la tarjeta se quedaría ahí sin explicación.
 */

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function CardDeleteButton({
  title,
  message,
  onDelete,
  label = "Eliminar",
}: {
  /** Qué se borra, para el título del diálogo. */
  title: string;
  message: string;
  /** Devuelve el motivo si el servidor se niega. */
  onDelete: () => Promise<{ error?: string } | void>;
  label?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function confirmar() {
    setError(null);
    startTransition(async () => {
      const r = await onDelete();
      if (r && "error" in r && r.error) {
        setError(r.error);
        return;
      }
      setAbierto(false);
    });
  }

  return (
    <>
      <button
        type="button"
        aria-label={`${label}: ${title}`}
        title={label}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAbierto(true);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.125rem",
          borderRadius: "0.25rem",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--app-text-muted)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#dc2626";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--app-text-muted)";
        }}
      >
        <Trash2 style={{ width: "1rem", height: "1rem" }} />
      </button>

      <ConfirmDialog
        open={abierto}
        title={`¿Eliminar ${title}?`}
        message={message}
        confirmLabel={pendiente ? "Eliminando…" : label}
        variant="danger"
        isPending={pendiente}
        onConfirm={confirmar}
        onCancel={() => {
          setAbierto(false);
          setError(null);
        }}
      >
        {error && (
          <p
            role="alert"
            style={{
              marginTop: "0.75rem",
              padding: "0.5rem 0.75rem",
              backgroundColor: "rgba(220,38,38,0.1)",
              border: "1px solid #dc2626",
              borderRadius: "0.5rem",
              color: "#dc2626",
              fontSize: "0.8125rem",
            }}
          >
            {error}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
