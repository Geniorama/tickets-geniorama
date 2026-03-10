"use client";

import { useTransition, useState } from "react";
import { resendInvitation } from "@/actions/invitation.actions";

export function ResendInvitationButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await resendInvitation(userId);
      if (result?.error) {
        setError(result.error);
      } else {
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      }
    });
  }

  if (sent) {
    return <span className="text-xs text-green-600 font-medium">✓ Enviado</span>;
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isPending}
        className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50 whitespace-nowrap"
        title="Reenviar invitación por email"
      >
        {isPending ? "Enviando..." : "Reenviar invitación"}
      </button>
      {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
    </div>
  );
}
