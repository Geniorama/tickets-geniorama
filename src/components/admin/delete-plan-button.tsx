"use client";

import { useTransition } from "react";
import { deletePlan } from "@/actions/plan.actions";
import { IconAction } from "@/components/ui/icon-action";

export function DeletePlanButton({
  planId,
  planName,
}: {
  planId: string;
  planName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        `¿Eliminar el plan "${planName}"? Los tickets asociados perderán su plan asignado. Esta acción no se puede deshacer.`
      )
    )
      return;
    startTransition(() => deletePlan(planId));
  }

  return <IconAction icon="trash" label="Eliminar plan" tone="danger" onClick={handleClick} pending={isPending} />;
}
