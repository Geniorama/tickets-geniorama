"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Building2, CalendarClock } from "lucide-react";
import type { DealStage } from "@/generated/prisma";
import { DEAL_STAGE_COLORS, DEAL_STAGE_DESCRIPTIONS, DEAL_STAGE_LABELS, formatAmount } from "@/lib/crm/deals";
import { setDealStage } from "@/actions/crm.actions";
import { formatDate } from "@/lib/format-date";

export type BoardDeal = {
  id: string;
  title: string;
  stage: DealStage;
  amount: number | null;
  expectedCloseAt: Date | string | null;
  company: { id: string; name: string };
  owner: { name: string } | null;
};

function DealCard({ deal, isDragging = false }: { deal: BoardDeal; isDragging?: boolean }) {
  const importe = formatAmount(deal.amount);

  return (
    <div
      style={{
        backgroundColor: "var(--app-content-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.5rem",
        padding: "0.75rem",
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)", lineHeight: 1.35, paddingRight: "1.25rem" }}>
        {deal.title}
      </p>

      {importe && (
        <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--app-body-text)", marginTop: "0.35rem", fontVariantNumeric: "tabular-nums" }}>
          {importe}
        </p>
      )}

      <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.6875rem", color: "var(--app-text-muted)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          <Building2 style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0 }} />
          {deal.company.name}
        </span>
        {deal.expectedCloseAt && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
            <CalendarClock style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0 }} />
            Cierre: {formatDate(deal.expectedCloseAt)}
          </span>
        )}
        {deal.owner && <span>Responsable: {deal.owner.name}</span>}
      </div>
    </div>
  );
}

function DraggableDeal({ deal, canEdit }: { deal: BoardDeal; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    disabled: !canEdit,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div ref={setNodeRef} style={{ ...style, position: "relative" }}>
      {canEdit && (
        <div
          {...listeners}
          {...attributes}
          style={{
            position: "absolute", top: "0.5rem", right: "0.5rem", zIndex: 20,
            cursor: "grab", padding: "0.125rem", borderRadius: "0.25rem",
            color: "var(--app-text-muted)",
          }}
        >
          <GripVertical style={{ width: "1rem", height: "1rem" }} />
        </div>
      )}
      <Link href={`/crm/oportunidades/${deal.id}`} style={{ display: "block", textDecoration: "none" }}>
        <DealCard deal={deal} isDragging={isDragging} />
      </Link>
    </div>
  );
}

function BoardColumn({
  stage, deals, canEdit, isOver,
}: {
  stage: DealStage; deals: BoardDeal[]; canEdit: boolean; isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: stage });
  const color = DEAL_STAGE_COLORS[stage];
  // El total de la columna es la pregunta que se hace al mirar un pipeline:
  // no cuántas hay, sino cuánto hay puesto en esta fase.
  const total = deals.reduce((sum, d) => sum + (d.amount ?? 0), 0);

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderTop: `4px solid ${color}`,
        borderRadius: "0.75rem",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--app-border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
          <span title={DEAL_STAGE_DESCRIPTIONS[stage]} style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)" }}>
            {DEAL_STAGE_LABELS[stage]}
          </span>
          <span
            style={{
              fontSize: "0.6875rem", fontWeight: 700, padding: "0.125rem 0.5rem",
              borderRadius: "9999px", backgroundColor: `${color}22`, color,
            }}
          >
            {deals.length}
          </span>
        </div>
        {total > 0 && (
          <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.2rem", fontVariantNumeric: "tabular-nums" }}>
            {formatAmount(total)}
          </p>
        )}
      </div>

      <div
        ref={setNodeRef}
        style={{
          display: "flex", flexDirection: "column", gap: "0.5rem",
          padding: "0.75rem", minHeight: "7.5rem",
          borderRadius: "0 0 0.75rem 0.75rem",
          backgroundColor: isOver ? "rgba(253,19,132,0.06)" : "transparent",
          transition: "background-color 0.15s",
        }}
      >
        {deals.length === 0 ? (
          <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", textAlign: "center", padding: "1.5rem 0" }}>
            Vacía
          </p>
        ) : (
          deals.map((d) => <DraggableDeal key={d.id} deal={d} canEdit={canEdit} />)
        )}
      </div>
    </div>
  );
}

/**
 * El pipeline. Arrastrar una tarjeta mueve la oportunidad de etapa; el cambio
 * se pinta al soltar y se revierte si el servidor lo rechaza, para que el
 * tablero nunca muestre algo que no se guardó.
 */
export function DealBoard({
  deals: initialDeals,
  stages,
  canEdit,
}: {
  deals: BoardDeal[];
  stages: DealStage[];
  canEdit: boolean;
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<DealStage | null>(null);
  const [, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) ?? null : null;

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setOverColumn(null);
    if (!over) return;

    const destino = over.id as DealStage;
    const deal = deals.find((d) => d.id === active.id);
    if (!deal || deal.stage === destino) return;

    const anterior = deal.stage;
    setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, stage: destino } : d)));

    startTransition(async () => {
      const result = await setDealStage(deal.id, destino);
      if (result?.error) {
        setDeals((prev) => prev.map((d) => (d.id === deal.id ? { ...d, stage: anterior } : d)));
      }
    });
  }

  return (
    <DndContext
      id="deal-board"
      sensors={sensors}
      onDragStart={({ active }: DragStartEvent) => setActiveId(active.id as string)}
      onDragOver={({ over }) => setOverColumn(over ? (over.id as DealStage) : null)}
      onDragEnd={handleDragEnd}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${stages.length}, minmax(215px, 1fr))`,
          gap: "1rem",
          alignItems: "start",
          // El pipeline se lee de izquierda a derecha: si no cabe, se desplaza
          // el tablero, no la página entera.
          overflowX: "auto",
          paddingBottom: "0.5rem",
        }}
      >
        {stages.map((stage) => (
          <BoardColumn
            key={stage}
            stage={stage}
            deals={deals.filter((d) => d.stage === stage)}
            canEdit={canEdit}
            isOver={overColumn === stage}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
        {activeDeal && (
          <div style={{ transform: "rotate(1deg)", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", borderRadius: "0.5rem" }}>
            <DealCard deal={activeDeal} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
