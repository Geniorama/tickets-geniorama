"use client";

import { useTransition } from "react";
import { deleteUser } from "@/actions/user.actions";

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
      const result = await deleteUser(userId);
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
