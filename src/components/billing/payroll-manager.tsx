"use client";

import { useState, useTransition } from "react";
import { Trash2, Copy } from "lucide-react";
import { createPayroll, deletePayroll, copyPreviousPayroll } from "@/actions/payroll.actions";
import { callAction } from "@/lib/run-action";

export type NominaFila = {
  id: string; personName: string; baseSalary: number; extras: number; contributions: number; total: number;
};

const campo: React.CSSProperties = {
  padding: "0.45rem 0.6rem", fontSize: "0.8125rem", borderRadius: "0.5rem",
  border: "1px solid var(--app-border)", backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
};
const celda: React.CSSProperties = { padding: "0.55rem 0.75rem", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" };
const num: React.CSSProperties = { ...celda, textAlign: "right", whiteSpace: "nowrap" };
const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export function PayrollManager({ filas, period, sugerencias }: { filas: NominaFila[]; period: string; sugerencias: string[] }) {
  const [persona, setPersona] = useState("");
  const [base, setBase] = useState("");
  const [extras, setExtras] = useState("");
  const [aportes, setAportes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const suma = (k: keyof NominaFila) => filas.reduce((s, f) => s + (f[k] as number), 0);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setAviso(null);
    startTransition(async () => {
      const r = await callAction(() => createPayroll({ period, personName: persona, baseSalary: base, extras, contributions: aportes }));
      if (r?.error) return setError(r.error);
      setPersona(""); setBase(""); setExtras(""); setAportes("");
    });
  }

  function copiar() {
    setError(null); setAviso(null);
    startTransition(async () => {
      const r = await callAction(() => copyPreviousPayroll(period));
      if (r?.error) return setError(r.error);
      setAviso(`Se copiaron ${r.copiados} personas del mes anterior.`);
    });
  }

  function borrar(id: string, nombre: string) {
    if (!window.confirm(`¿Quitar a ${nombre} de la nómina de este mes? También se borra su costo.`)) return;
    startTransition(async () => {
      const r = await callAction(() => deletePayroll(id));
      if (r?.error) setError(r.error);
    });
  }

  return (
    <div>
      <form onSubmit={guardar} style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "flex-end", marginBottom: "0.75rem" }}>
        <input aria-label="Persona" list="nomina-personas" placeholder="Persona" value={persona} onChange={(e) => setPersona(e.target.value)} style={{ ...campo, flex: "1 1 11rem" }} />
        <datalist id="nomina-personas">{sugerencias.map((s) => <option key={s} value={s} />)}</datalist>
        <input aria-label="Salario base" placeholder="Salario base" inputMode="numeric" value={base} onChange={(e) => setBase(e.target.value)} style={{ ...campo, width: "9rem" }} />
        <input aria-label="Bonos y extras" placeholder="Bonos / extras" inputMode="numeric" value={extras} onChange={(e) => setExtras(e.target.value)} style={{ ...campo, width: "9rem" }} />
        <input aria-label="Aportes y prestaciones" placeholder="Aportes y prestaciones" inputMode="numeric" value={aportes} onChange={(e) => setAportes(e.target.value)} style={{ ...campo, width: "11rem" }} />
        <button type="submit" disabled={isPending} style={{ padding: "0.45rem 0.9rem", fontSize: "0.8125rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#fd1384", color: "#fff", cursor: "pointer", opacity: isPending ? 0.6 : 1 }}>
          Añadir
        </button>
        <button type="button" onClick={copiar} disabled={isPending} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.45rem 0.85rem", fontSize: "0.8125rem", borderRadius: "0.5rem", border: "1px solid var(--app-border)", background: "none", color: "var(--app-nav-text)", cursor: "pointer" }}>
          <Copy style={{ width: "0.85rem", height: "0.85rem" }} /> Copiar mes anterior
        </button>
      </form>
      {error && <p role="alert" style={{ fontSize: "0.8125rem", color: "#dc2626", marginBottom: "0.6rem" }}>{error}</p>}
      {aviso && <p style={{ fontSize: "0.8125rem", color: "#16a34a", marginBottom: "0.6rem" }}>{aviso}</p>}

      <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "40rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--app-border)", color: "var(--app-text-muted)", fontSize: "0.7rem", textTransform: "uppercase" }}>
              <th style={{ ...celda, textAlign: "left", fontWeight: 600 }}>Persona</th>
              <th style={{ ...num, fontWeight: 600 }}>Salario base</th>
              <th style={{ ...num, fontWeight: 600 }}>Bonos / extras</th>
              <th style={{ ...num, fontWeight: 600 }}>Aportes y prestaciones</th>
              <th style={{ ...num, fontWeight: 600 }}>Costo total</th>
              <th style={{ width: "2rem" }} />
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr><td colSpan={6} style={{ ...celda, color: "var(--app-text-muted)" }}>Aún no hay nómina en este mes. Añade a las personas o copia el mes anterior.</td></tr>
            )}
            {filas.map((f) => (
              <tr key={f.id} style={{ borderBottom: "1px solid var(--app-border)", color: "var(--app-body-text)" }}>
                <td style={{ ...celda, fontWeight: 500 }}>{f.personName}</td>
                <td style={num}>{pesos.format(f.baseSalary)}</td>
                <td style={num}>{pesos.format(f.extras)}</td>
                <td style={num}>{pesos.format(f.contributions)}</td>
                <td style={{ ...num, fontWeight: 600 }}>{pesos.format(f.total)}</td>
                <td style={celda}>
                  <button type="button" aria-label={`Quitar a ${f.personName}`} onClick={() => borrar(f.id, f.personName)} disabled={isPending} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--app-text-muted)" }}>
                    <Trash2 style={{ width: "0.9rem", height: "0.9rem" }} />
                  </button>
                </td>
              </tr>
            ))}
            {filas.length > 0 && (
              <tr style={{ color: "var(--app-body-text)", fontWeight: 700 }}>
                <td style={celda}>Total del mes</td>
                <td style={num}>{pesos.format(suma("baseSalary"))}</td>
                <td style={num}>{pesos.format(suma("extras"))}</td>
                <td style={num}>{pesos.format(suma("contributions"))}</td>
                <td style={num}>{pesos.format(suma("total"))}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
