"use client";

import { useState, useTransition } from "react";
import type { DealStage } from "@/generated/prisma";
import { DEAL_STAGES, DEAL_STAGE_COLORS, DEAL_STAGE_DESCRIPTIONS, DEAL_STAGE_LABELS } from "@/lib/crm/deals";
import { setDealStage } from "@/actions/crm.actions";

/**
 * Mover la oportunidad de etapa desde su ficha.
 *
 * Marcarla como perdida pide el motivo en el momento: preguntarlo después no
 * funciona, y es el dato que más enseña del pipeline con el tiempo.
 */
export function DealStageSelector({
  dealId,
  current,
}: {
  dealId: string;
  current: DealStage;
}) {
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [isPending, startTransition] = useTransition();

  function mover(stage: DealStage, razon?: string) {
    startTransition(async () => {
      await setDealStage(dealId, stage, razon);
      setPidiendoMotivo(false);
      setMotivo("");
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
        {DEAL_STAGES.map((stage) => {
          const active = stage === current;
          const color = DEAL_STAGE_COLORS[stage];
          return (
            <button
              key={stage}
              type="button"
              disabled={isPending || active}
              title={DEAL_STAGE_DESCRIPTIONS[stage]}
              onClick={() => (stage === "PERDIDA" ? setPidiendoMotivo(true) : mover(stage))}
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
              {DEAL_STAGE_LABELS[stage]}
            </button>
          );
        })}
      </div>

      {pidiendoMotivo && (
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="¿Por qué se perdió?"
            autoFocus
            style={{
              padding: "0.4rem 0.65rem", fontSize: "0.8125rem", width: "16rem",
              borderRadius: "0.45rem", border: "1px solid var(--app-border)",
              backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
            }}
          />
          <button
            type="button"
            disabled={isPending}
            onClick={() => mover("PERDIDA", motivo)}
            style={{
              fontSize: "0.8125rem", fontWeight: 500, padding: "0.4rem 0.8rem",
              borderRadius: "0.45rem", border: "none", backgroundColor: "#ef4444",
              color: "#fff", cursor: isPending ? "wait" : "pointer",
            }}
          >
            Marcar perdida
          </button>
          <button
            type="button"
            onClick={() => { setPidiendoMotivo(false); setMotivo(""); }}
            style={{
              fontSize: "0.8125rem", padding: "0.4rem 0.7rem", borderRadius: "0.45rem",
              border: "1px solid var(--app-border)", background: "none",
              color: "var(--app-text-muted)", cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
