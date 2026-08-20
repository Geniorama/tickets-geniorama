"use client";

import { useTransition } from "react";
import type { AccountStage } from "@/generated/prisma";
import { ACCOUNT_STAGES, ACCOUNT_STAGE_COLORS, ACCOUNT_STAGE_DESCRIPTIONS, ACCOUNT_STAGE_LABELS } from "@/lib/crm/accounts";
import { setAccountStage } from "@/actions/crm.actions";

/**
 * Mover una cuenta de etapa es la acción más frecuente del CRM, así que está a
 * un clic en la ficha y no escondida en el formulario de edición.
 */
export function StageSelector({
  accountId,
  current,
}: {
  accountId: string;
  current: AccountStage;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
      {ACCOUNT_STAGES.map((stage) => {
        const active = stage === current;
        const color = ACCOUNT_STAGE_COLORS[stage];
        return (
          <button
            key={stage}
            type="button"
            disabled={isPending || active}
            title={ACCOUNT_STAGE_DESCRIPTIONS[stage]}
            onClick={() => startTransition(async () => { await setAccountStage(accountId, stage); })}
            style={{
              fontSize: "0.75rem", fontWeight: active ? 700 : 500,
              padding: "0.35rem 0.7rem", borderRadius: "0.45rem",
              border: `1px solid ${active ? color : "var(--app-border)"}`,
              backgroundColor: active ? `${color}22` : "transparent",
              color: active ? color : "var(--app-nav-text)",
              cursor: active ? "default" : isPending ? "wait" : "pointer",
              opacity: isPending && !active ? 0.6 : 1,
            }}
          >
            {ACCOUNT_STAGE_LABELS[stage]}
          </button>
        );
      })}
    </div>
  );
}
