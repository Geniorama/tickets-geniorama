"use client";

import { useTransition } from "react";
import { deleteService } from "@/actions/service.actions";

export function DeleteServiceButton({ serviceId }: { serviceId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("¿Eliminar este servicio? Esta acción no se puede deshacer.")) return;
    startTransition(() => deleteService(serviceId));
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      style={{
        fontSize: "0.8125rem",
        color: "#dc2626",
        background: "none",
        border: "1px solid rgba(239,68,68,0.3)",
        borderRadius: "0.5rem",
        padding: "0.4rem 0.875rem",
        cursor: isPending ? "not-allowed" : "pointer",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      {isPending ? "Eliminando…" : "Eliminar servicio"}
    </button>
  );
}
