"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setProjectActive } from "@/actions/project.actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Activa o desactiva un proyecto, con confirmación. No va dentro de un <Link>:
 * un botón dentro de un enlace es HTML inválido y el clic navegaría.
 */
export function ProjectActiveSwitch({
  projectId,
  projectName,
  isActive,
  size = "md",
}: {
  projectId: string;
  projectName: string;
  isActive: boolean;
  size?: "sm" | "md";
}) {
  // Mientras la acción corre se muestra el valor pedido; al terminar vuelve a
  // mandar el que llega del servidor (o el anterior, si falló).
  const [active, setOptimisticActive] = useOptimistic(isActive);
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lo que se pidió al abrir: con el valor optimista, `!active` cambiaría a
  // mitad de la confirmación.
  const [next, setNext] = useState(!isActive);
  const trackW = size === "sm" ? 1.75 : 2.125;
  const trackH = size === "sm" ? 1 : 1.25;
  const knob = trackH - 0.25;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      setOptimisticActive(next);
      const result = await setProjectActive(projectId, next);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={active ? `Desactivar ${projectName}` : `Activar ${projectName}`}
        title={active ? "Desactivar proyecto" : "Activar proyecto"}
        disabled={isPending}
        onClick={() => { setError(null); setNext(!active); setOpen(true); }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.4rem",
          background: "none",
          border: "none",
          padding: 0,
          cursor: isPending ? "wait" : "pointer",
          opacity: isPending ? 0.6 : 1,
          fontSize: size === "sm" ? "0.75rem" : "0.8125rem",
          fontWeight: 500,
          color: active ? "#15803d" : "var(--app-text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "relative",
            display: "inline-block",
            width: `${trackW}rem`,
            height: `${trackH}rem`,
            borderRadius: "9999px",
            backgroundColor: active ? "#22c55e" : "var(--app-border)",
            transition: "background-color 0.15s",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: "0.125rem",
              left: active ? `${trackW - knob - 0.125}rem` : "0.125rem",
              width: `${knob}rem`,
              height: `${knob}rem`,
              borderRadius: "9999px",
              backgroundColor: "#ffffff",
              boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
              transition: "left 0.15s",
            }}
          />
        </span>
        {active ? "Activo" : "Inactivo"}
      </button>

      <ConfirmDialog
        open={open}
        title={next ? "Activar proyecto" : "Desactivar proyecto"}
        message={
          next
            ? `¿Activar «${projectName}»? Volverá a contar como proyecto activo.`
            : `¿Desactivar «${projectName}»? Pasará a Inactivo; sus tareas se conservan y puedes reactivarlo cuando quieras.`
        }
        confirmLabel={next ? "Activar" : "Desactivar"}
        variant={next ? "default" : "danger"}
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => { if (!isPending) setOpen(false); }}
      >
        {error && (
          <p role="alert" style={{ margin: 0, fontSize: "0.8125rem", color: "#dc2626" }}>
            {error}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
