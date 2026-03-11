"use client";

import { useTransition } from "react";
import { deleteCompany } from "@/actions/company.actions";

export function DeleteCompanyButton({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        `¿Eliminar la empresa "${companyName}"? Esta acción no se puede deshacer.`
      )
    )
      return;
    startTransition(async () => {
      const result = await deleteCompany(companyId);
      if (result?.error) alert(result.error);
    });
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
