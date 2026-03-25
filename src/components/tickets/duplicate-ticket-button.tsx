"use client";

import { useState, useTransition } from "react";
import { Copy, Loader2 } from "lucide-react";
import { duplicateTicket } from "@/actions/ticket.actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function DuplicateTicketButton({ ticketId }: { ticketId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await duplicateTicket(ticketId);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isPending}
        title="Duplicar ticket"
        className="inline-flex items-center gap-1.5 text-sm font-medium border rounded px-2 py-1 disabled:opacity-50"
        style={{
          color: "var(--app-text-muted)",
          borderColor: "var(--app-border)",
          background: "none",
          cursor: isPending ? "not-allowed" : "pointer",
          transition: "color 0.15s, border-color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "#fd1384";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(253,19,132,0.4)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "var(--app-text-muted)";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--app-border)";
        }}
      >
        {isPending
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Copy className="w-3.5 h-3.5" />
        }
        Duplicar
      </button>

      <ConfirmDialog
        open={open}
        title="Duplicar ticket"
        message="Se creará una copia de este ticket con estado Por asignar. ¿Deseas continuar?"
        confirmLabel="Duplicar"
        variant="default"
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
