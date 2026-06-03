"use client";

import { useTransition } from "react";
import { deleteCompany } from "@/actions/company.actions";
import { IconAction } from "@/components/ui/icon-action";

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

  return <IconAction icon="trash" label="Eliminar empresa" tone="danger" onClick={handleClick} pending={isPending} />;
}
