"use client";

/**
 * Aviso flotante para acciones que fallaron sin que nadie esperara el resultado
 * (pausar un timer, borrar, reordenar…). Antes un fallo ahí no se veía y la
 * pantalla seguía como si hubiera funcionado.
 *
 * Se alimenta de `fireAction` (lib/run-action.ts) a través de un evento del
 * navegador, así que cualquier componente puede avisar sin pasar props.
 * Va montado una sola vez, en el layout raíz.
 */

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { ACTION_ERROR_EVENT } from "@/lib/run-action";

type Toast = { id: number; message: string };

const MAX_VISIBLE = 3;
const LIFETIME_MS = 7000;

export function ActionToaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    function onError(e: Event) {
      const message = String((e as CustomEvent<string>).detail ?? "").trim();
      if (!message) return;
      const id = nextId.current++;
      setToasts((prev) => {
        // El mismo aviso repetido no se apila.
        if (prev.some((t) => t.message === message)) return prev;
        return [...prev, { id, message }].slice(-MAX_VISIBLE);
      });
      window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), LIFETIME_MS);
    }
    window.addEventListener(ACTION_ERROR_EVENT, onError);
    return () => window.removeEventListener(ACTION_ERROR_EVENT, onError);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        right: "1rem",
        bottom: "1rem",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
        maxWidth: "min(24rem, calc(100vw - 2rem))",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.625rem",
            padding: "0.75rem 0.875rem",
            borderRadius: "0.625rem",
            fontSize: "0.8125rem",
            lineHeight: 1.45,
            backgroundColor: "var(--tone-red-bg)",
            color: "var(--tone-red-fg)",
            border: "1px solid var(--tone-red-bd)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
          }}
        >
          <AlertTriangle style={{ width: "1rem", height: "1rem", flexShrink: 0, marginTop: "0.125rem" }} />
          <span style={{ flex: 1 }}>{t.message}</span>
          <button
            type="button"
            aria-label="Cerrar aviso"
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, display: "flex" }}
          >
            <X style={{ width: "0.875rem", height: "0.875rem" }} />
          </button>
        </div>
      ))}
    </div>
  );
}
