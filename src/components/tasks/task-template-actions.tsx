"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { createTaskFromTemplate, deleteTaskTemplate } from "@/actions/task-template.actions";
import { IconAction, IconActionLink } from "@/components/ui/icon-action";

export function TaskTemplateActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      const res = await createTaskFromTemplate(id);
      if (res?.error) alert(res.error);
      // si tiene éxito, la acción redirige a la tarea creada
    });
  }

  function remove() {
    if (!confirm(`¿Eliminar la plantilla "${name}"?`)) return;
    startTransition(async () => {
      const res = await deleteTaskTemplate(id);
      if (res?.error) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
      <IconAction icon="zap" label="Crear tarea con esta plantilla" onClick={create} pending={isPending} />
      <IconActionLink icon="form" label="Usar en el formulario de nueva tarea" href={`/tareas/new?template=${id}`} />
      <IconActionLink icon="pencil" label="Editar plantilla" href={`/tareas/plantillas/${id}/edit`} />
      <IconAction icon="trash" label="Eliminar plantilla" tone="danger" onClick={remove} pending={isPending} />
    </div>
  );
}
