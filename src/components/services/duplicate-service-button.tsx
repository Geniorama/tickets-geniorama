"use client";

import { useState, useTransition } from "react";
import { Copy, Loader2 } from "lucide-react";
import { duplicateService } from "@/actions/service.actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function DuplicateServiceButton({ serviceId }: { serviceId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await duplicateService(serviceId);
      setOpen(false);
    });
  }

  return (
    <>
      <div style={{ position: "relative", display: "inline-flex" }} className="dup-btn-wrap">
        <style>{`
          .dup-btn-wrap:hover .dup-tooltip { opacity: 1; transform: translateX(-50%) translateY(0); }
          @keyframes dup-spin { to { transform: rotate(360deg); } }
          .dup-spin { animation: dup-spin 1s linear infinite; }
        `}</style>
        <button
          onClick={() => setOpen(true)}
          disabled={isPending}
          title="Duplicar servicio"
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
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#fd1384"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#fd1384"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--app-text-muted)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--app-border)"; }}
        >
          {isPending
            ? <Loader2 className="dup-spin" style={{ width: "0.875rem", height: "0.875rem" }} />
            : <Copy style={{ width: "0.875rem", height: "0.875rem" }} />
          }
        </button>
        <span
          className="dup-tooltip"
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
          Duplicar servicio
        </span>
      </div>

      <ConfirmDialog
        open={open}
        title="Duplicar servicio"
        message="Se creará una copia de este servicio con los mismos datos. ¿Deseas continuar?"
        confirmLabel="Duplicar"
        variant="default"
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
