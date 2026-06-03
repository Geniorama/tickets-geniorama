"use client";

import { useTransition, useState } from "react";
import { resendInvitation } from "@/actions/invitation.actions";
import { IconAction } from "@/components/ui/icon-action";

export function ResendInvitationButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function handleClick() {
    startTransition(async () => {
      const result = await resendInvitation(userId);
      if (result?.error) {
        alert(result.error);
      } else {
        setSent(true);
        setTimeout(() => setSent(false), 3000);
      }
    });
  }

  if (sent) {
    return <IconAction icon="check" label="Invitación enviada" tone="success" disabled />;
  }

  return <IconAction icon="mail" label="Reenviar invitación" tone="neutral" onClick={handleClick} pending={isPending} />;
}
