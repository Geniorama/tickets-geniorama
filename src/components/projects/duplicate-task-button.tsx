"use client";

import { useState, useTransition } from "react";
import { Copy, Loader2 } from "lucide-react";
import { duplicateTask } from "@/actions/task.actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function DuplicateTaskButton({
  taskId,
  projectId,
}: {
  taskId: string;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await duplicateTask(taskId, projectId);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={isPending}
        title="Duplicar tarea"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          fontSize: "0.8125rem",
          color: "var(--app-text-muted)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.375rem",
          padding: "0.25rem 0.625rem",
          background: "none",
          cursor: isPending ? "not-allowed" : "pointer",
          fontWeight: 500,
          opacity: isPending ? 0.5 : 1,
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
          ? <Loader2 style={{ width: "0.875rem", height: "0.875rem", animation: "spin 1s linear infinite" }} />
          : <Copy style={{ width: "0.875rem", height: "0.875rem" }} />
        }
        Duplicar
      </button>

      <ConfirmDialog
        open={open}
        title="Duplicar tarea"
        message="Se creará una copia de esta tarea con estado Pendiente y sin fechas. ¿Deseas continuar?"
        confirmLabel="Duplicar"
        variant="default"
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
