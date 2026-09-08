"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { calcularTotales, describirImpuesto, EXENTO, IVA_RATE, type LineaConCategoria } from "@/lib/billing/totals";
import { formatAmount, parseAmount } from "@/lib/money";
import { AmountInput, formatearImporte } from "@/components/ui/amount-input";

/**
 * Las líneas de un cobro, con su total al pie.
 *
 * El total se calcula aquí solo para que se vea mientras se escribe; el que
 * se guarda lo recalcula el servidor. Si el navegador pudiera fijar el total,
 * un cobro podría decir cualquier cosa.
 */

type Fila = { concept: string; amount: string; taxRate: number; categoryId: string };

export type Categoria = { id: string; name: string };

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "0.5rem 0.7rem", fontSize: "0.875rem",
  borderRadius: "0.5rem", border: "1px solid var(--app-border)",
  backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
};

/**
 * El concepto de una línea, en un campo que crece con lo que se escribe.
 *
 * Era un `input` de una línea metido en una columna estrecha, y los conceptos
 * de una factura rara vez caben ahí: se escribían a ciegas, viendo el final
 * de la frase y no el principio. Ahora ocupa el ancho del formulario y se
 * estira solo, así que lo escrito se lee entero sin desplazarse.
 */
function ConceptoInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // La altura se recalcula en cada render y no solo al teclear: al cargar un
  // cobro existente el texto ya viene puesto, y sin esto aparecería recortado.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      placeholder="Rediseño del sitio: maquetación de las ocho plantillas, migración de contenidos y puesta en producción."
      aria-label="Concepto de la línea"
      style={{
        ...inputStyle,
        // Sin asa de redimensionar: la altura la pone el efecto de arriba, y lo
        // que se estirase a mano se perdería en la siguiente tecla.
        resize: "none",
        minHeight: "3.5rem",
        lineHeight: 1.45,
        overflow: "hidden",
        fontFamily: "inherit",
      }}
    />
  );
}

export function LineEditor({
  initial,
  categorias,
}: {
  initial?: LineaConCategoria[];
  /** Lo que ofrece el desplegable. Solo las activas. */
  categorias: Categoria[];
}) {
  const [filas, setFilas] = useState<Fila[]>(
    initial && initial.length > 0
      ? initial.map((l) => ({
          concept: l.concept, amount: formatearImporte(l.amount),
          taxRate: l.taxRate, categoryId: l.categoryId ?? "",
        }))
      : [{ concept: "", amount: "", taxRate: EXENTO, categoryId: "" }],
  );

  const lineas = useMemo(
    () =>
      filas
        .map((f) => ({
          concept: f.concept.trim(),
          amount: parseAmount(f.amount) ?? 0,
          taxRate: f.taxRate,
          categoryId: f.categoryId || null,
        }))
        .filter((l) => l.concept.length > 0 && l.amount > 0),
    [filas],
  );

  const totales = useMemo(() => calcularTotales(lineas), [lineas]);

  // Cuántas líneas cargadas se quedaron sin catalogar. Contabilidad lo pide
  // para poder cuadrar, así que se avisa aquí y no cuando ya está guardado.
  const sinCategoria = lineas.filter((l) => !l.categoryId).length;

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

      {/* Cada línea es un bloque y no una fila: con conceptos de varios
          renglones, una rejilla sola no deja ver dónde acaba una y empieza la
          siguiente. */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {filas.map((f, i) => (
          <div
            key={i}
            style={{
              border: "1px solid var(--app-border)", borderRadius: "0.6rem",
              padding: "0.6rem", display: "flex", flexDirection: "column", gap: "0.4rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.4rem" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <ConceptoInput
                  value={f.concept}
                  onChange={(v) => actualizar(i, { concept: v })}
                />
              </div>
              <button
                type="button"
                onClick={() => setFilas((prev) => (prev.length === 1 ? prev : prev.filter((_, j) => j !== i)))}
                disabled={filas.length === 1}
                aria-label="Quitar línea"
                title={filas.length === 1 ? "Un cobro necesita al menos una línea" : "Quitar"}
                style={{
                  background: "none", border: "none", padding: "0.45rem 0.2rem",
                  color: filas.length === 1 ? "var(--app-border)" : "#dc2626",
                  cursor: filas.length === 1 ? "not-allowed" : "pointer",
                }}
              >
                <Trash2 style={{ width: "0.9rem", height: "0.9rem" }} />
              </button>
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-[9rem_minmax(0,1fr)_8rem]"
              style={{ gap: "0.4rem", alignItems: "center" }}
            >
              <AmountInput
                value={f.amount}
                onValueChange={(v) => actualizar(i, { amount: v })}
                placeholder="1.200.000"
                style={{ ...inputStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
                ariaLabel="Importe de la línea"
              />
              <select
                value={f.categoryId}
                onChange={(e) => actualizar(i, { categoryId: e.target.value })}
                style={inputStyle}
                aria-label="Categoría de la línea"
              >
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={f.taxRate}
                onChange={(e) => actualizar(i, { taxRate: Number(e.target.value) })}
                style={inputStyle}
                aria-label="Impuesto de la línea"
              >
                <option value={EXENTO}>Exento</option>
                <option value={IVA_RATE}>+{IVA_RATE}% IVA</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          setFilas((prev) => [
            ...prev,
            // Hereda la categoría de la última línea: en una factura de varias
            // líneas lo normal es repetir categoría, no cambiarla.
            { concept: "", amount: "", taxRate: EXENTO, categoryId: prev.at(-1)?.categoryId ?? "" },
          ])
        }
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.3rem",
          marginTop: "0.6rem", background: "none", border: "none", padding: 0,
          fontSize: "0.8125rem", fontWeight: 500, color: "#fd1384", cursor: "pointer",
        }}
      >
        <Plus style={{ width: "0.9rem", height: "0.9rem" }} />
        Añadir concepto
      </button>

      {sinCategoria > 0 && (
        <p style={{ fontSize: "0.75rem", color: "#b45309", marginTop: "0.5rem" }}>
          {sinCategoria === 1
            ? "Una línea se queda sin categoría."
            : `${sinCategoria} líneas se quedan sin categoría.`}{" "}
          Contabilidad no podrá catalogarlas.
        </p>
      )}

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
