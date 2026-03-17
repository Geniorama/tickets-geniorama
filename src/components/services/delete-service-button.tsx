"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { deleteService } from "@/actions/service.actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function DeleteServiceButton({ serviceId }: { serviceId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await deleteService(serviceId);
      setOpen(false);
    });
  }

  return (
    <>
      <div style={{ position: "relative", display: "inline-flex" }} className="del-btn-wrap">
        <style>{`
          .del-btn-wrap:hover .del-tooltip { opacity: 1; transform: translateX(-50%) translateY(0); }
          @keyframes del-spin { to { transform: rotate(360deg); } }
          .del-spin { animation: del-spin 1s linear infinite; }
        `}</style>
        <button
          onClick={() => setOpen(true)}
          disabled={isPending}
          title="Eliminar servicio"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "2rem",
            height: "2rem",
            background: "none",
            border: "1px solid var(--app-border)",
            borderRadius: "0.5rem",
            cursor: isPending ? "not-allowed" : "pointer",
            opacity: isPending ? 0.5 : 1,
            color: "var(--app-text-muted)",
            transition: "color 0.15s, border-color 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#dc2626"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.5)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--app-text-muted)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--app-border)"; }}
        >
          {isPending
            ? <Loader2 className="del-spin" style={{ width: "0.875rem", height: "0.875rem" }} />
            : <Trash2 style={{ width: "0.875rem", height: "0.875rem" }} />
          }
        </button>
        <span
          className="del-tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%) translateY(4px)",
            backgroundColor: "#1e293b",
            color: "#f8fafc",
            fontSize: "0.75rem",
            padding: "0.25rem 0.5rem",
            borderRadius: "0.375rem",
            whiteSpace: "nowrap",
            opacity: 0,
            transition: "opacity 0.15s, transform 0.15s",
            pointerEvents: "none",
          }}
        >
          Eliminar servicio
        </span>
      </div>

      <ConfirmDialog
        open={open}
        title="Eliminar servicio"
        message="Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar este servicio?"
        confirmLabel="Eliminar"
        variant="danger"
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
