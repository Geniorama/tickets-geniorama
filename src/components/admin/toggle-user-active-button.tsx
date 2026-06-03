"use client";

import { useTransition } from "react";
import { toggleUserActive } from "@/actions/user.actions";
import { IconAction } from "@/components/ui/icon-action";

export function ToggleUserActiveButton({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await toggleUserActive(userId, !isActive);
    });
  }

  if (isSelf) {
    return <IconAction icon="power-off" label="No puedes desactivarte a ti mismo" disabled />;
  }

  return isActive ? (
    <IconAction icon="power-off" label="Desactivar usuario" tone="danger" onClick={handleClick} pending={isPending} />
  ) : (
    <IconAction icon="power" label="Activar usuario" tone="success" onClick={handleClick} pending={isPending} />
  );
}
