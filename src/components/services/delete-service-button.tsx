"use client";

import { useState, useTransition } from "react";
import { deleteService } from "@/actions/service.actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconAction } from "@/components/ui/icon-action";

export function DeleteServiceButton({ serviceId }: { serviceId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await deleteService(serviceId);
      setOpen(false);
    });
  }

  return (
    <>
      <IconAction icon="trash" label="Eliminar servicio" tone="danger" onClick={() => setOpen(true)} pending={isPending} />

      <ConfirmDialog
        open={open}
        title="Eliminar servicio"
        message="Esta acción no se puede deshacer. ¿Estás seguro de que deseas eliminar este servicio?"
        confirmLabel="Eliminar"
        variant="danger"
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
