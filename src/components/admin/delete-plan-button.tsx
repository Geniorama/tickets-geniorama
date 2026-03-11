"use client";

import { useTransition } from "react";
import { deletePlan } from "@/actions/plan.actions";

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

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
    >
      {isPending ? "..." : "Eliminar"}
    </button>
  );
}
