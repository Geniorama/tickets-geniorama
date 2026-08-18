"use client";

import { useState, useTransition } from "react";
import { Copy, Loader2 } from "lucide-react";
import { duplicateTicket } from "@/actions/ticket.actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DuplicateChecklistsOption } from "@/components/ui/duplicate-checklists-option";

export function DuplicateTicketButton({
  ticketId,
  checklistItemCount = 0,
  className,
}: {
  ticketId: string;
  checklistItemCount?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [withChecklists, setWithChecklists] = useState(true);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await duplicateTicket(ticketId, checklistItemCount > 0 && withChecklists);
      setOpen(false);
    });
  }

  const isMenuItem = className !== undefined;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isPending}
        title="Duplicar ticket"
        className={
          className ??
          "inline-flex items-center gap-1.5 text-sm font-medium border rounded px-2 py-1 disabled:opacity-50"
        }
        style={isMenuItem ? {
          color: "var(--dropdown-text)",
          background: "none",
          cursor: isPending ? "not-allowed" : "pointer",
        } : {
          color: "var(--app-text-muted)",
          borderColor: "var(--app-border)",
          background: "none",
          cursor: isPending ? "not-allowed" : "pointer",
          transition: "color 0.15s, border-color 0.15s",
        }}
        onMouseEnter={isMenuItem
          ? (e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--dropdown-hover-bg)"; }
          : (e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#fd1384";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(253,19,132,0.4)";
          }}
        onMouseLeave={isMenuItem
          ? (e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }
          : (e) => {
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
      >
        <DuplicateChecklistsOption
          itemCount={checklistItemCount}
          checked={withChecklists}
          disabled={isPending}
          onChange={setWithChecklists}
        />
      </ConfirmDialog>
    </>
  );
}
