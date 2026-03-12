"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteVaultEntry } from "@/actions/vault.actions";

export function DeleteVaultButton({ entryId, entryTitle }: { entryId: string; entryTitle: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (!confirm(`¿Eliminar "${entryTitle}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      await deleteVaultEntry(entryId);
      router.push("/boveda");
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.25rem",
        fontSize: "0.8125rem", color: "#b91c1c", border: "1px solid #fecaca",
        borderRadius: "0.375rem", padding: "0.25rem 0.625rem",
        background: "none", cursor: isPending ? "not-allowed" : "pointer",
        fontWeight: 500, opacity: isPending ? 0.6 : 1,
      }}
    >
      <Trash2 style={{ width: "0.875rem", height: "0.875rem" }} />
      {isPending ? "Eliminando..." : "Eliminar"}
    </button>
  );
}
