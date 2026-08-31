"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { calcularTotales, describirImpuesto, EXENTO, IVA_RATE, type LineaCobro } from "@/lib/billing/totals";
import { formatAmount, parseAmount } from "@/lib/money";
import { AmountInput, formatearImporte } from "@/components/ui/amount-input";

/**
 * Las líneas de un cobro, con su total al pie.
 *
 * El total se calcula aquí solo para que se vea mientras se escribe; el que
 * se guarda lo recalcula el servidor. Si el navegador pudiera fijar el total,
 * un cobro podría decir cualquier cosa.
 */

type Fila = { concept: string; amount: string; taxRate: number };

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.7rem", fontSize: "0.875rem",
  borderRadius: "0.5rem", border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
};

export function LineEditor({ initial }: { initial?: LineaCobro[] }) {
  const [filas, setFilas] = useState<Fila[]>(
    initial && initial.length > 0
      ? initial.map((l) => ({ concept: l.concept, amount: formatearImporte(l.amount), taxRate: l.taxRate }))
      : [{ concept: "", amount: "", taxRate: EXENTO }],
  );

  const lineas: LineaCobro[] = useMemo(
    () =>
      filas
        .map((f) => ({ concept: f.concept.trim(), amount: parseAmount(f.amount) ?? 0, taxRate: f.taxRate }))
        .filter((l) => l.concept.length > 0 && l.amount > 0),
    [filas],
  );

  const totales = useMemo(() => calcularTotales(lineas), [lineas]);

  function actualizar(i: number, cambio: Partial<Fila>) {
    setFilas((prev) => prev.map((f, j) => (j === i ? { ...f, ...cambio } : f)));
  }

  return (
    <div>
      {/* Lo que se envía. El servidor no se fía del total, solo de las líneas. */}
      <input type="hidden" name="lines" value={JSON.stringify(lineas)} />

      <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.45rem" }}>
        Conceptos
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {filas.map((f, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 8rem 8.5rem 2rem", gap: "0.4rem", alignItems: "center" }}>
            <input
              value={f.concept}
              onChange={(e) => actualizar(i, { concept: e.target.value })}
              placeholder="Hosting — septiembre"
              style={inputStyle}
            />
            <AmountInput
              value={f.amount}
              onValueChange={(v) => actualizar(i, { amount: v })}
              placeholder="1.200.000"
              style={{ ...inputStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
              ariaLabel="Importe de la línea"
            />
            <select
              value={f.taxRate}
              onChange={(e) => actualizar(i, { taxRate: Number(e.target.value) })}
              style={inputStyle}
              aria-label="Impuesto de la línea"
            >
              <option value={EXENTO}>Exento</option>
              <option value={IVA_RATE}>+{IVA_RATE}% IVA</option>
            </select>
            <button
              type="button"
              onClick={() => setFilas((prev) => (prev.length === 1 ? prev : prev.filter((_, j) => j !== i)))}
              disabled={filas.length === 1}
              aria-label="Quitar línea"
              title={filas.length === 1 ? "Un cobro necesita al menos una línea" : "Quitar"}
              style={{
                background: "none", border: "none", padding: "0.2rem",
                color: filas.length === 1 ? "var(--app-border)" : "#dc2626",
                cursor: filas.length === 1 ? "not-allowed" : "pointer",
              }}
            >
              <Trash2 style={{ width: "0.9rem", height: "0.9rem" }} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setFilas((prev) => [...prev, { concept: "", amount: "", taxRate: EXENTO }])}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.3rem",
          marginTop: "0.6rem", background: "none", border: "none", padding: 0,
          fontSize: "0.8125rem", fontWeight: 500, color: "#fd1384", cursor: "pointer",
        }}
      >
        <Plus style={{ width: "0.9rem", height: "0.9rem" }} />
        Añadir concepto
      </button>

      {/* El desglose se enseña siempre: con todo exento, ver «IVA $0» confirma
          que se eligió, en vez de dejar la duda de si se olvidó. */}
      <div
        style={{
          marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--app-border)",
          display: "flex", flexDirection: "column", gap: "0.35rem",
        }}
      >
        <Linea etiqueta="Subtotal" valor={totales.subtotal} />
        <Linea etiqueta="IVA" valor={totales.taxAmount} />
        <Linea etiqueta="Total" valor={totales.total} destacada />
      </div>

      {lineas.length === 0 && (
        <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.5rem" }}>
          Cada línea necesita un concepto y un importe para contar en el total.
        </p>
      )}
    </div>
  );
}

function Linea({ etiqueta, valor, destacada }: { etiqueta: string; valor: number; destacada?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
      <span style={{ fontSize: destacada ? "0.875rem" : "0.8125rem", fontWeight: destacada ? 600 : 400, color: destacada ? "var(--app-body-text)" : "var(--app-text-muted)" }}>
        {etiqueta}
      </span>
      <span
        style={{
          fontSize: destacada ? "1.125rem" : "0.875rem",
          fontWeight: destacada ? 700 : 500,
          color: "var(--app-body-text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {formatAmount(valor)}
      </span>
    </div>
  );
}

export { describirImpuesto };
