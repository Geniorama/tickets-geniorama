"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { createExpense, deleteExpense } from "@/actions/expense.actions";
import { callAction } from "@/lib/run-action";

export type CostoFila = {
  id: string; concept: string; kind: string; amount: number; fecha: string; supplier: string | null;
};

const TIPOS: Record<string, string> = { PERSONAL: "Personal", PROVEEDOR: "Proveedores", OPERACION: "Operación" };
const campo: React.CSSProperties = {
  padding: "0.45rem 0.6rem", fontSize: "0.8125rem", borderRadius: "0.5rem",
  border: "1px solid var(--app-border)", backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
};
const celda: React.CSSProperties = { padding: "0.55rem 0.75rem", fontSize: "0.8125rem" };
const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function ExpenseManager({ costos, hoy }: { costos: CostoFila[]; hoy: string }) {
  const [concept, setConcept] = useState("");
  const [kind, setKind] = useState("OPERACION");
  const [amount, setAmount] = useState("");
  const [incurredOn, setIncurredOn] = useState(hoy);
  const [supplier, setSupplier] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await callAction(() => createExpense({ concept, kind, amount, incurredOn, supplier }));
      if (r?.error) return setError(r.error);
      setConcept(""); setAmount(""); setSupplier("");
    });
  }

  function borrar(id: string) {
    if (!window.confirm("¿Borrar este costo?")) return;
    startTransition(async () => {
      const r = await callAction(() => deleteExpense(id));
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div>
      <form onSubmit={guardar} style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "flex-end", marginBottom: "1.25rem" }}>
        <input aria-label="Concepto" placeholder="Concepto" value={concept} onChange={(e) => setConcept(e.target.value)} style={{ ...campo, flex: "1 1 12rem" }} />
        <select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value)} style={campo}>
          {Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input aria-label="Importe" placeholder="Importe (COP)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...campo, width: "9rem" }} />
        <input aria-label="Fecha" type="date" value={incurredOn} onChange={(e) => setIncurredOn(e.target.value)} style={campo} />
        <input aria-label="Proveedor" placeholder="Proveedor (opcional)" value={supplier} onChange={(e) => setSupplier(e.target.value)} style={{ ...campo, width: "11rem" }} />
        <button type="submit" disabled={isPending} style={{ padding: "0.45rem 0.9rem", fontSize: "0.8125rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#fd1384", color: "#fff", cursor: "pointer", opacity: isPending ? 0.6 : 1 }}>
          Añadir costo
        </button>
      </form>
      {error && <p role="alert" style={{ fontSize: "0.8125rem", color: "#dc2626", marginBottom: "0.75rem" }}>{error}</p>}

      <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "36rem" }}>
          <tbody>
            {costos.length === 0 && (
              <tr><td style={{ ...celda, color: "var(--app-text-muted)" }}>Aún no hay costos registrados en este periodo.</td></tr>
            )}
            {costos.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--app-border)" }}>
                <td style={{ ...celda, color: "var(--app-text-muted)", whiteSpace: "nowrap" }}>{c.fecha}</td>
                <td style={{ ...celda, color: "var(--app-body-text)", fontWeight: 500 }}>
                  {c.concept}{c.supplier ? <span style={{ color: "var(--app-text-muted)", fontWeight: 400 }}> · {c.supplier}</span> : null}
                </td>
                <td style={{ ...celda, color: "var(--app-text-muted)" }}>{TIPOS[c.kind]}</td>
                <td style={{ ...celda, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--app-body-text)" }}>{pesos.format(c.amount)}</td>
                <td style={{ ...celda, width: "2rem" }}>
                  <button type="button" aria-label="Borrar costo" onClick={() => borrar(c.id)} disabled={isPending} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--app-text-muted)" }}>
                    <Trash2 style={{ width: "0.9rem", height: "0.9rem" }} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
