"use client";

import { useTransition } from "react";
import { deleteSite } from "@/actions/site.actions";
import { IconAction } from "@/components/ui/icon-action";

export function DeleteSiteButton({ siteId, siteName }: { siteId: string; siteName: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`¿Eliminar el sitio "${siteName}"? Los tickets vinculados perderán esta referencia.`)) return;
    startTransition(async () => { await deleteSite(siteId); });
  }

  return <IconAction icon="trash" label="Eliminar sitio" tone="danger" onClick={handleDelete} pending={isPending} />;
}
