"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable, type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Building2, CalendarClock, Hash, Paperclip } from "lucide-react";
import type { BillingStatus } from "@/generated/prisma";
import {
  BILLING_STATUS_COLORS, BILLING_STATUS_DESCRIPTIONS, BILLING_STATUS_LABELS, isClosed, isInvoiced, pendiente,
} from "@/lib/billing/status";
import { formatAmount, parseAmount } from "@/lib/money";
import { useRouter } from "next/navigation";
import { setBillingStatus, deleteBillingItem } from "@/actions/billing.actions";
import { CardDeleteButton } from "@/components/ui/card-delete-button";
import { addBillingPayment } from "@/actions/billing-payments.actions";
import { formatDate } from "@/lib/format-date";
import { AmountInput } from "@/components/ui/amount-input";

export type BoardItem = {
  id: string;
  concept: string;
  status: BillingStatus;
  amount: number;
  paidAmount: number;
  dueDate: Date | string | null;
  createdAt: Date | string;
  invoiceNumber: string | null;
  company: { id: string; name: string };
  owner: { name: string } | null;
  labels: { id: string; name: string; color: string }[];
  /** Cuántos soportes/novedades tiene: se ve sin abrir la tarjeta. */
  notes: number;
};

type SortKey = "dueDate" | "createdAt" | "concept" | "company" | "label" | "amount" | "pending";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "dueDate", label: "Fecha límite" },
  { key: "createdAt", label: "Fecha de creación" },
  { key: "concept", label: "Nombre" },
  { key: "company", label: "Empresa" },
  { key: "label", label: "Etiqueta" },
  { key: "amount", label: "Importe" },
  { key: "pending", label: "Pendiente por cobrar" },
];

const SORT_STORAGE = "billing-board-sort";

const controlStyle: React.CSSProperties = {
  padding: "0.4rem 0.6rem", fontSize: "0.8125rem", borderRadius: "0.5rem",
  border: "1px solid var(--app-border)", backgroundColor: "var(--app-card-bg)",
  color: "var(--app-body-text)",
};

const time = (d: Date | string | null) => (d ? new Date(d).getTime() : null);

/** Compara dos valores; los vacíos van siempre al final, sea cual sea el sentido. */
function cmp<T extends string | number>(a: T | null, b: T | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const r = typeof a === "string"
    ? a.localeCompare(b as string, "es", { sensitivity: "base" })
    : (a as number) - (b as number);
  return r * dir;
}

function sortItems(items: BoardItem[], key: SortKey, dir: 1 | -1): BoardItem[] {
  const value = (i: BoardItem): string | number | null => {
    switch (key) {
      case "dueDate": return time(i.dueDate);
      case "createdAt": return time(i.createdAt);
      case "concept": return i.concept;
      case "company": return i.company.name;
      case "label": {
        const names = i.labels.map((l) => l.name).sort((x, y) => x.localeCompare(y, "es"));
        return names[0] ?? null;
      }
      case "amount": return i.amount;
      case "pending": return pendiente(i.amount, i.paidAmount);
    }
  };
  // Desempate estable por fecha de creación (más reciente primero).
  return [...items].sort((a, b) =>
    cmp(value(a), value(b), dir) || (time(b.createdAt)! - time(a.createdAt)!),
  );
}

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
      {item.labels.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginBottom: "0.4rem", paddingRight: "1.25rem" }}>
          {item.labels.map((l) => (
            <span
              key={l.id}
              style={{
                fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.02em",
                padding: "0.1rem 0.4rem", borderRadius: "9999px",
                backgroundColor: `${l.color}22`, color: l.color,
              }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}

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
        {/* Saber que hay un soporte adjunto sin tener que abrir la tarjeta es
            media respuesta a «¿ya pagaron?». */}
        {item.notes > 0 && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
            <Paperclip style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0 }} />
            {item.notes} {item.notes === 1 ? "novedad" : "novedades"}
          </span>
        )}
      </div>
    </div>
  );
}

function DraggableItem({
  item, canEdit, canDelete, onDeleted,
}: {
  item: BoardItem;
  canEdit: boolean;
  canDelete: boolean;
  onDeleted: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: item.id, disabled: !canEdit,
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <div ref={setNodeRef} style={{ ...style, position: "relative" }}>
      {/* El asa y la papelera comparten esquina: las dos van por encima del
          enlace que cubre la tarjeta. */}
      <div
        style={{
          position: "absolute", top: "0.5rem", right: "0.5rem", zIndex: 20,
          display: "flex", alignItems: "center", gap: "0.15rem",
        }}
      >
        {canDelete && (
          <CardDeleteButton
            title={`el cobro «${item.concept}»`}
            // Con dinero ya registrado se dice el importe: mover una tarjeta
            // con abonos hacia atrás está prohibido justamente por esto, y
            // borrarla se lo lleva todo por delante sin más aviso que este.
            message={
              item.paidAmount > 0
                ? `Este cobro de ${item.company.name} tiene ${formatAmount(item.paidAmount)} ya registrados en abonos. Se eliminarán también, con sus comprobantes. No se puede deshacer.`
                : `Se eliminará el cobro de ${item.company.name}, con sus novedades y soportes. No se puede deshacer.`
            }
            onDelete={async () => {
              const r = await deleteBillingItem(item.id, false);
              if (r && "error" in r && typeof r.error === "string") return { error: r.error };
              onDeleted(item.id);
            }}
          />
        )}
        {canEdit && (
          <div
            {...listeners}
            {...attributes}
            style={{
              cursor: "grab", padding: "0.125rem", borderRadius: "0.25rem",
              color: "var(--app-text-muted)",
            }}
          >
            <GripVertical style={{ width: "1rem", height: "1rem" }} />
          </div>
        )}
      </div>
      <Link href={`/facturacion/${item.id}`} style={{ display: "block", textDecoration: "none" }}>
        <ItemCard item={item} isDragging={isDragging} />
      </Link>
    </div>
  );
}

function Columna({
  status, items, canEdit, canDelete, isOver, onDeleted,
}: {
  status: BillingStatus;
  items: BoardItem[];
  canEdit: boolean;
  canDelete: boolean;
  isOver: boolean;
  onDeleted: (id: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: status });
  const color = BILLING_STATUS_COLORS[status];

  // En las columnas de cobro lo que interesa es lo que falta por entrar, no lo
  // facturado: en «Abonado» sumar el total mentiría sobre la caja pendiente.
  const total = items.reduce(
    (s, i) => s + (isClosed(status) ? i.amount : pendiente(i.amount, i.paidAmount)),
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
            {!isClosed(status) && " por cobrar"}
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
          items.map((i) => (
            <DraggableItem
              key={i.id}
              item={i}
              canEdit={canEdit}
              canDelete={canDelete}
              onDeleted={onDeleted}
            />
          ))
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
  canDelete = false,
}: {
  items: BoardItem[];
  statuses: BillingStatus[];
  canEdit: boolean;
  /** Borrar un cobro se lleva el rastro de un dinero: pide GESTOR, no EDITAR. */
  canDelete?: boolean;
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
  const [fechaAbono, setFechaAbono] = useState("");
  const [errorAbono, setErrorAbono] = useState<string | null>(null);
  // Pasar a «Facturado» exige el número de factura: se pregunta antes de mover.
  const [pidiendoFactura, setPidiendoFactura] = useState<{ item: BoardItem; destino: BillingStatus } | null>(null);
  const [numeroFactura, setNumeroFactura] = useState("");
  const [errorFactura, setErrorFactura] = useState<string | null>(null);
  // Un error al mover se veía como una tarjeta que vuelve sola a su sitio, sin
  // decir por qué. Con abonos de por medio hay motivos reales para negarse.
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Por defecto, como siempre: fecha límite ascendente. Se recuerda por navegador.
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SORT_STORAGE);
      if (!raw) return;
      const s = JSON.parse(raw) as { key?: SortKey; dir?: 1 | -1 };
      if (s.key && SORT_OPTIONS.some((o) => o.key === s.key)) setSortKey(s.key);
      if (s.dir === 1 || s.dir === -1) setSortDir(s.dir);
    } catch { /* sin almacenamiento: se queda el orden por defecto */ }
  }, []);
  function cambiarOrden(key: SortKey, dir: 1 | -1) {
    setSortKey(key);
    setSortDir(dir);
    try { localStorage.setItem(SORT_STORAGE, JSON.stringify({ key, dir })); } catch { /* idem */ }
  }

  // Filtros: se combinan (todos los activos deben cumplirse). Solo en el cliente,
  // porque el tablero ya trae todos los cobros.
  const [busca, setBusca] = useState("");
  const [fEtiqueta, setFEtiqueta] = useState("");
  const [fEmpresa, setFEmpresa] = useState("");
  const [fResponsable, setFResponsable] = useState("");
  const [fVencimiento, setFVencimiento] = useState<"" | "vencidos" | "sinFecha" | "conFecha">("");

  const opciones = useMemo(() => {
    const etiquetas = new Map<string, string>();
    const empresas = new Map<string, string>();
    const responsables = new Set<string>();
    for (const i of items) {
      i.labels.forEach((l) => etiquetas.set(l.id, l.name));
      empresas.set(i.company.id, i.company.name);
      if (i.owner) responsables.add(i.owner.name);
    }
    const porNombre = (a: [string, string], b: [string, string]) => a[1].localeCompare(b[1], "es");
    return {
      etiquetas: [...etiquetas].sort(porNombre),
      empresas: [...empresas].sort(porNombre),
      responsables: [...responsables].sort((a, b) => a.localeCompare(b, "es")),
    };
  }, [items]);

  const hayFiltros = !!(busca || fEtiqueta || fEmpresa || fResponsable || fVencimiento);
  function limpiarFiltros() {
    setBusca(""); setFEtiqueta(""); setFEmpresa(""); setFResponsable(""); setFVencimiento("");
  }

  const ordenados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const filtrados = items.filter((i) => {
      if (q && !`${i.concept} ${i.company.name} ${i.invoiceNumber ?? ""}`.toLowerCase().includes(q)) return false;
      if (fEtiqueta && !i.labels.some((l) => l.id === fEtiqueta)) return false;
      if (fEmpresa && i.company.id !== fEmpresa) return false;
      if (fResponsable === "__none") { if (i.owner) return false; }
      else if (fResponsable && i.owner?.name !== fResponsable) return false;
      if (fVencimiento === "sinFecha" && i.dueDate) return false;
      if (fVencimiento === "conFecha" && !i.dueDate) return false;
      if (fVencimiento === "vencidos") {
        // Vencido: con fecha pasada y sin cerrar el cobro.
        if (!i.dueDate || isClosed(i.status) || new Date(i.dueDate).getTime() >= hoy.getTime()) return false;
      }
      return true;
    });
    return sortItems(filtrados, sortKey, sortDir);
  }, [items, sortKey, sortDir, busca, fEtiqueta, fEmpresa, fResponsable, fVencimiento]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const activo = activeId ? items.find((i) => i.id === activeId) ?? null : null;

  /** Saca del tablero lo que el servidor ya borró. */
  function quitar(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    // Los totales por columna los calcula el servidor: sin esto, la cabecera
    // seguiría sumando un cobro que ya no está.
    router.refresh();
  }

  function mover(item: BoardItem, destino: BillingStatus, invoiceNumber?: string) {
    const anterior = item.status;
    setItems((prev) => prev.map((i) => (
      i.id === item.id ? { ...i, status: destino, invoiceNumber: invoiceNumber ?? i.invoiceNumber } : i
    )));

    setError(null);
    startTransition(async () => {
      const r = await setBillingStatus(item.id, destino, invoiceNumber);
      if (r?.error) {
        setItems((prev) => prev.map((i) => (
          i.id === item.id ? { ...i, status: anterior, invoiceNumber: item.invoiceNumber } : i
        )));
        setError(r.error);
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
      setErrorAbono(null);
      // Por defecto, hoy: es cuando se apunta la inmensa mayoría de los pagos.
      setFechaAbono(new Date().toLocaleDateString("en-CA"));
      return;
    }
    if (isInvoiced(destino) && !isInvoiced(item.status) && !item.invoiceNumber) {
      setPidiendoFactura({ item, destino });
      setNumeroFactura("");
      setErrorFactura(null);
      return;
    }
    mover(item, destino);
  }

  return (
    <>
      {error && (
        <div
          role="alert"
          style={{
            display: "flex", alignItems: "flex-start", gap: "0.6rem",
            backgroundColor: "#dc262614", border: "1px solid #dc262655",
            borderRadius: "0.75rem", padding: "0.75rem 1rem", marginBottom: "1rem",
            fontSize: "0.8125rem", color: "var(--app-nav-text)",
          }}
        >
          <span style={{ flex: 1 }}>{error}</span>
          <button
            type="button" onClick={() => setError(null)} aria-label="Cerrar aviso"
            style={{ background: "none", border: "none", padding: 0, color: "var(--app-text-muted)", cursor: "pointer" }}
          >
            ×
          </button>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <label htmlFor="billing-sort" style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>
          Ordenar por
        </label>
        <select
          id="billing-sort"
          value={sortKey}
          onChange={(e) => cambiarOrden(e.target.value as SortKey, sortDir)}
          style={{
            padding: "0.4rem 0.6rem", fontSize: "0.8125rem", borderRadius: "0.5rem",
            border: "1px solid var(--app-border)", backgroundColor: "var(--app-card-bg)",
            color: "var(--app-body-text)",
          }}
        >
          {SORT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => cambiarOrden(sortKey, sortDir === 1 ? -1 : 1)}
          title="Invertir el orden"
          style={{
            padding: "0.4rem 0.7rem", fontSize: "0.8125rem", borderRadius: "0.5rem",
            border: "1px solid var(--app-border)", background: "none",
            color: "var(--app-nav-text)", cursor: "pointer",
          }}
        >
          {sortDir === 1 ? "↑ Ascendente" : "↓ Descendente"}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar concepto, empresa o factura…"
          aria-label="Buscar cobros"
          style={{ ...controlStyle, minWidth: "14rem" }}
        />
        <select value={fEtiqueta} onChange={(e) => setFEtiqueta(e.target.value)} aria-label="Filtrar por etiqueta" style={controlStyle}>
          <option value="">Todas las etiquetas</option>
          {opciones.etiquetas.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <select value={fEmpresa} onChange={(e) => setFEmpresa(e.target.value)} aria-label="Filtrar por empresa" style={controlStyle}>
          <option value="">Todas las empresas</option>
          {opciones.empresas.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
        </select>
        <select value={fResponsable} onChange={(e) => setFResponsable(e.target.value)} aria-label="Filtrar por responsable" style={controlStyle}>
          <option value="">Todos los responsables</option>
          <option value="__none">Sin responsable</option>
          {opciones.responsables.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select
          value={fVencimiento}
          onChange={(e) => setFVencimiento(e.target.value as typeof fVencimiento)}
          aria-label="Filtrar por fecha límite"
          style={controlStyle}
        >
          <option value="">Cualquier fecha límite</option>
          <option value="vencidos">Vencidos</option>
          <option value="conFecha">Con fecha límite</option>
          <option value="sinFecha">Sin fecha límite</option>
        </select>
        {hayFiltros && (
          <button
            type="button" onClick={limpiarFiltros}
            style={{ ...controlStyle, background: "none", color: "#fd1384", cursor: "pointer" }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

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
              items={ordenados.filter((i) => i.status === s)}
              canEdit={canEdit}
              canDelete={canDelete}
              isOver={overColumn === s}
              onDeleted={quitar}
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

      {pidiendoFactura && (
        <div
          role="dialog"
          aria-label="Número de factura"
          style={{
            position: "fixed", inset: 0, zIndex: 9600,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
          }}
          onClick={() => setPidiendoFactura(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const numero = numeroFactura.trim();
              if (!numero) return setErrorFactura("Escribe el número de factura");
              const { item, destino } = pidiendoFactura;
              setPidiendoFactura(null);
              mover(item, destino, numero);
            }}
            style={{
              width: "100%", maxWidth: "24rem",
              backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
              borderRadius: "0.75rem", padding: "1.25rem",
              display: "flex", flexDirection: "column", gap: "0.85rem",
            }}
          >
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--app-body-text)" }}>
                Número de factura
              </h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
                {pidiendoFactura.item.concept} · para pasarlo a «{BILLING_STATUS_LABELS[pidiendoFactura.destino]}» hace falta la factura emitida.
              </p>
            </div>

            <input
              autoFocus
              value={numeroFactura}
              maxLength={60}
              onChange={(e) => setNumeroFactura(e.target.value)}
              placeholder="FV-1042"
              aria-label="Número de factura"
              style={{
                width: "100%", padding: "0.55rem 0.75rem", fontSize: "0.875rem",
                borderRadius: "0.5rem", border: "1px solid var(--app-border)",
                backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
              }}
            />

            {errorFactura && (
              <p style={{ fontSize: "0.8125rem", color: "#b91c1c", margin: 0 }}>{errorFactura}</p>
            )}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="submit"
                style={{
                  backgroundColor: BILLING_STATUS_COLORS.FACTURADO, color: "#fff", border: "none",
                  borderRadius: "0.5rem", padding: "0.5rem 1rem",
                  fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
                }}
              >
                Pasar a facturado
              </button>
              <button
                type="button"
                onClick={() => setPidiendoFactura(null)}
                style={{
                  border: "1px solid var(--app-border)", background: "none",
                  borderRadius: "0.5rem", padding: "0.5rem 0.9rem",
                  fontSize: "0.875rem", color: "var(--app-text-muted)", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

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
                {pidiendoAbono.concept} · faltan {formatAmount(pendiente(pidiendoAbono.amount, pidiendoAbono.paidAmount))}
                {pidiendoAbono.paidAmount > 0 && ` de ${formatAmount(pidiendoAbono.amount)}`}
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

            <div>
              <label htmlFor="fechaAbono" style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginBottom: "0.2rem" }}>
                Cuándo entró
              </label>
              <input
                id="fechaAbono" type="date" value={fechaAbono}
                onChange={(e) => setFechaAbono(e.target.value)}
                style={{
                  width: "100%", padding: "0.5rem 0.7rem", fontSize: "0.875rem",
                  borderRadius: "0.5rem", border: "1px solid var(--app-border)",
                  backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
                }}
              />
            </div>

            {errorAbono && (
              <p style={{ fontSize: "0.8125rem", color: "#b91c1c", margin: 0 }}>{errorAbono}</p>
            )}

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => {
                  const monto = parseAmount(abono);
                  if (monto === null || monto <= 0) return setErrorAbono("Escribe cuánto entró");
                  if (!fechaAbono) return setErrorAbono("Falta la fecha del abono");

                  const item = pidiendoAbono;
                  setPidiendoAbono(null);
                  setErrorAbono(null);
                  startTransition(async () => {
                    const fd = new FormData();
                    fd.set("amount", String(monto));
                    fd.set("paidOn", fechaAbono);
                    const r = await addBillingPayment(item.id, fd);
                    if (r?.error) return setError(r.error);
                    // El estado lo decide el dinero: con esto puede quedar en
                    // «Abonado» o saltar a «Pagado» si cubre el total.
                    router.refresh();
                  });
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
