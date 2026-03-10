"use client";

import { useTransition } from "react";
import { toggleUserActive } from "@/actions/user.actions";

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
    return (
      <span className="text-xs text-gray-300 cursor-not-allowed" title="No puedes desactivarte a ti mismo">
        {isActive ? "Desactivar" : "Activar"}
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`text-xs font-medium transition-colors disabled:opacity-50 ${
        isActive
          ? "text-red-500 hover:text-red-700"
          : "text-green-600 hover:text-green-800"
      }`}
    >
      {isPending ? "..." : isActive ? "Desactivar" : "Activar"}
    </button>
  );
}
