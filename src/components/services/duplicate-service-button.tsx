"use client";

import { useState, useTransition } from "react";
import { duplicateService } from "@/actions/service.actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { IconAction } from "@/components/ui/icon-action";

export function DuplicateServiceButton({ serviceId }: { serviceId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await duplicateService(serviceId);
      setOpen(false);
    });
  }

  return (
    <>
      <IconAction icon="copy" label="Duplicar servicio" tone="neutral" onClick={() => setOpen(true)} pending={isPending} />

      <ConfirmDialog
        open={open}
        title="Duplicar servicio"
        message="Se creará una copia de este servicio con los mismos datos. ¿Deseas continuar?"
        confirmLabel="Duplicar"
        variant="default"
        isPending={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
