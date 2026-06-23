"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteTicketTemplate } from "@/actions/ticket-template.actions";
import { IconAction, IconActionLink } from "@/components/ui/icon-action";

export function TicketTemplateActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function remove() {
    if (!confirm(`¿Eliminar la plantilla "${name}"?`)) return;
    startTransition(async () => {
      const res = await deleteTicketTemplate(id);
      if (res?.error) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
      <IconActionLink icon="form" label="Usar en el formulario de nuevo ticket" href={`/tickets/new?template=${id}`} />
      <IconActionLink icon="pencil" label="Editar plantilla" href={`/tickets/plantillas/${id}/edit`} />
      <IconAction icon="trash" label="Eliminar plantilla" tone="danger" onClick={remove} pending={isPending} />
    </div>
  );
}
