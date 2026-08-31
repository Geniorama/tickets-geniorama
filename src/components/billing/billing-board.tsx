"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Building2, CalendarClock, Hash } from "lucide-react";
import type { BillingStatus } from "@/generated/prisma";
import {
  BILLING_STATUS_COLORS, BILLING_STATUS_DESCRIPTIONS, BILLING_STATUS_LABELS, pendiente,
} from "@/lib/billing/status";
import { formatAmount, parseAmount } from "@/lib/money";
import { setBillingStatus } from "@/actions/billing.actions";
import { formatDate } from "@/lib/format-date";
import { AmountInput } from "@/components/ui/amount-input";

export type BoardItem = {
  id: string;
  concept: string;
  status: BillingStatus;
  amount: number;
  paidAmount: number;
  dueDate: Date | string | null;
  invoiceNumber: string | null;
  company: { id: string; name: string };
  owner: { name: string } | null;
};

function ItemCard({ item, isDragging = false }: { item: BoardItem; isDragging?: boolean }) {
  const falta = pendiente(item.amount, item.paidAmount);
  const parcial = item.paidAmount > 0 && falta > 0;

  return (
    <div
      style={{
        backgroundColor: "var(--app-content-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.5rem", padding: "0.75rem",
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)", lineHeight: 1.35, paddingRight: "1.25rem" }}>
        {item.concept}
      </p>

      <p style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--app-body-text)", marginTop: "0.35rem", fontVariantNumeric: "tabular-nums" }}>
        {formatAmount(item.amount)}
      </p>

      {/* En un abono, lo que importa no es lo facturado sino lo que falta. */}
      {parcial && (
        <p style={{ fontSize: "0.75rem", color: "#f59e0b", fontVariantNumeric: "tabular-nums", marginTop: "0.1rem" }}>
          Abonado {formatAmount(item.paidAmount)} · faltan {formatAmount(falta)}
        </p>
      )}

      <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.2rem", fontSize: "0.6875rem", color: "var(--app-text-muted)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
          <Building2 style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0 }} />
          {item.company.name}
        </span>
        {item.invoiceNumber && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
            <Hash style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0 }} />
            {item.invoiceNumber}
          </span>
        )}
        {item.dueDate && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
            <CalendarClock style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0 }} />
            {formatDate(item.dueDate)}
          </span>
        )}
        {item.owner && <span>Responsable: {item.owner.name}</span>}
      </div>
    </div>
  );
}

function DraggableItem({ item, canEdit }: { item: BoardItem; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id, disabled: !canEdit,
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
      <Link href={`/facturacion/${item.id}`} style={{ display: "block", textDecoration: "none" }}>
        <ItemCard item={item} isDragging={isDragging} />
      </Link>
    </div>
  );
}

function Columna({
  status, items, canEdit, isOver,
}: {
  status: BillingStatus; items: BoardItem[]; canEdit: boolean; isOver: boolean;
}) {
  const { setNodeRef } = useDroppable({ id: status });
  const color = BILLING_STATUS_COLORS[status];

  // En las columnas de cobro lo que interesa es lo que falta por entrar, no lo
  // facturado: en «Abonado» sumar el total mentiría sobre la caja pendiente.
  const total = items.reduce(
    (s, i) => s + (status === "PAGADO" ? i.amount : pendiente(i.amount, i.paidAmount)),
    0,
  );

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderTop: `4px solid ${color}`,
        borderRadius: "0.75rem",
        display: "flex", flexDirection: "column",
      }}
    >
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--app-border)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
          <span title={BILLING_STATUS_DESCRIPTIONS[status]} style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)" }}>
            {BILLING_STATUS_LABELS[status]}
          </span>
          <span style={{ fontSize: "0.6875rem", fontWeight: 700, padding: "0.125rem 0.5rem", borderRadius: "9999px", backgroundColor: `${color}22`, color }}>
            {items.length}
          </span>
        </div>
        {total > 0 && (
          <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.2rem", fontVariantNumeric: "tabular-nums" }}>
            {formatAmount(total)}
            {status !== "PAGADO" && " por cobrar"}
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
        {items.length === 0 ? (
          <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", textAlign: "center", padding: "1.5rem 0" }}>
            Vacía
          </p>
        ) : (
          items.map((i) => <DraggableItem key={i.id} item={i} canEdit={canEdit} />)
        )}
      </div>
    </div>
  );
}

/**
 * El tablero de cobros — las mismas listas que había en Trello.
 *
 * Soltar en «Abonado» pregunta cuánto entró, porque es la única columna que no
 * se puede deducir del movimiento: en las demás el importe ya está dicho.
 */
export function BillingBoard({
  items: initialItems,
  statuses,
  canEdit,
}: {
  items: BoardItem[];
  statuses: BillingStatus[];
  canEdit: boolean;
}) {
  const [items, setItems] = useState(initialItems);

  // `useState` solo usa su valor inicial la primera vez; al cambiar de filtro
  // sin recargar habría que repintar con lo viejo. Mismo patrón que el CRM.
  const [vistos, setVistos] = useState(initialItems);
  if (vistos !== initialItems) {
    setVistos(initialItems);
    setItems(initialItems);
  }

  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<BillingStatus | null>(null);
  const [pidiendoAbono, setPidiendoAbono] = useState<BoardItem | null>(null);
  const [abono, setAbono] = useState("");
  const [, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const activo = activeId ? items.find((i) => i.id === activeId) ?? null : null;

  function mover(item: BoardItem, destino: BillingStatus, monto?: number | null) {
    const anterior = item.status;
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: destino } : i)));

    startTransition(async () => {
      const r = await setBillingStatus(item.id, destino, monto);
      if (r?.error) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: anterior } : i)));
      }
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    setOverColumn(null);
    if (!over) return;

    const destino = over.id as BillingStatus;
    const item = items.find((i) => i.id === active.id);
    if (!item || item.status === destino) return;

    if (destino === "ABONADO") {
      // Cuánto entró no se puede adivinar: se pregunta antes de mover.
      setPidiendoAbono(item);
      setAbono("");
      return;
    }
    mover(item, destino);
  }

  return (
    <>
      <DndContext
        id="billing-board"
        sensors={sensors}
        onDragStart={({ active }: DragStartEvent) => setActiveId(active.id as string)}
        onDragOver={({ over }) => setOverColumn(over ? (over.id as BillingStatus) : null)}
        onDragEnd={handleDragEnd}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${statuses.length}, minmax(215px, 1fr))`,
            gap: "1rem", alignItems: "start",
            overflowX: "auto", paddingBottom: "0.5rem",
          }}
        >
          {statuses.map((s) => (
            <Columna
              key={s}
              status={s}
              items={items.filter((i) => i.status === s)}
              canEdit={canEdit}
              isOver={overColumn === s}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
          {activo && (
            <div style={{ transform: "rotate(1deg)", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", borderRadius: "0.5rem" }}>
              <ItemCard item={activo} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {pidiendoAbono && (
        <div
          role="dialog"
          aria-label="Registrar abono"
          style={{
            position: "fixed", inset: 0, zIndex: 9600,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
          }}
          onClick={() => setPidiendoAbono(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: "24rem",
              backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
              borderRadius: "0.75rem", padding: "1.25rem",
              display: "flex", flexDirection: "column", gap: "0.85rem",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--app-body-text)" }}>
                ¿Cuánto abonaron?
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
                {pidiendoAbono.concept} · total {formatAmount(pidiendoAbono.amount)}
              </p>
            </div>

            <AmountInput
              value={abono}
              onValueChange={setAbono}
              placeholder="500.000"
              ariaLabel="Importe abonado"
              style={{
                width: "100%", padding: "0.55rem 0.75rem", fontSize: "0.875rem",
                borderRadius: "0.5rem", border: "1px solid var(--app-border)",
                backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
                textAlign: "right", fontVariantNumeric: "tabular-nums",
              }}
            />

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => {
                  const monto = parseAmount(abono);
                  if (monto === null || monto <= 0) return;
                  mover(pidiendoAbono, "ABONADO", monto);
                  setPidiendoAbono(null);
                }}
                style={{
                  backgroundColor: "#f59e0b", color: "#fff", border: "none",
                  borderRadius: "0.5rem", padding: "0.5rem 1rem",
                  fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
                }}
              >
                Registrar abono
              </button>
              <button
                type="button"
                onClick={() => setPidiendoAbono(null)}
                style={{
                  border: "1px solid var(--app-border)", background: "none",
                  borderRadius: "0.5rem", padding: "0.5rem 0.9rem",
                  fontSize: "0.875rem", color: "var(--app-text-muted)", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
