"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteSite } from "@/actions/site.actions";

export function DeleteSiteButton({ siteId, siteName }: { siteId: string; siteName: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`¿Eliminar el sitio "${siteName}"? Los tickets vinculados perderán esta referencia.`)) return;
    startTransition(async () => { await deleteSite(siteId); });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
    >
      <Trash2 className="w-3.5 h-3.5" />
      Eliminar
    </button>
  );
}
