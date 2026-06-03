"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteVaultEntry } from "@/actions/vault.actions";
import { IconAction } from "@/components/ui/icon-action";

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

  return <IconAction icon="trash" label="Eliminar entrada" tone="danger" onClick={handleDelete} pending={isPending} />;
}
