"use client";

import { useTransition } from "react";
import { deleteUser } from "@/actions/user.actions";
import { callAction } from "@/lib/run-action";
import { IconAction } from "@/components/ui/icon-action";

export function DeleteUserButton({
  userId,
  userName,
  isSelf,
}: {
  userId: string;
  userName: string;
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  if (isSelf) return null;

  function handleClick() {
    if (
      !confirm(
        `¿Eliminar al usuario "${userName}"? Esta acción no se puede deshacer.`
      )
    )
      return;
    startTransition(async () => {
      const result = await callAction(() => deleteUser(userId));
      if (result?.error) alert(result.error);
    });
  }

  return <IconAction icon="trash" label="Eliminar usuario" tone="danger" onClick={handleClick} pending={isPending} />;
}
