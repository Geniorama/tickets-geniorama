import Link from "next/link";
import { AlertTriangle } from "lucide-react";

/**
 * Lo que pide atención hoy, en una línea.
 *
 * El inicio tenía las mismas cifras repartidas en cuatro sitios: un KPI, una
 * tarjeta de alerta, un resumen de productividad y otra vez en las tarjetas de
 * módulo. Aquí se dicen **una vez**, arriba del todo, y lo de abajo pasa a ser
 * el detalle de esto y no una segunda cuenta en paralelo.
 *
 * Si no hay nada urgente no se pinta nada: un aviso que sale siempre deja de
 * leerse a la semana.
 */

export type AttentionItem = {
  count: number;
  /** Singular y plural, para no escribir «1 tareas vencidas». */
  one: string;
  many: string;
  href: string;
  tone: "grave" | "aviso";
};

const TONES = {
  grave: { color: "#dc2626", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.30)" },
  aviso: { color: "#d97706", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.30)" },
} as const;

export function AttentionBar({ items }: { items: AttentionItem[] }) {
  const conAlgo = items.filter((i) => i.count > 0);
  if (conAlgo.length === 0) return null;

  // Lo vencido antes que lo que va a vencer: es lo que ya duele.
  const ordenados = [...conAlgo].sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "grave" ? -1 : 1));

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap",
        padding: "0.85rem 1rem", marginBottom: "1.5rem",
        borderRadius: "0.75rem",
        border: "1px solid rgba(239,68,68,0.25)",
        backgroundColor: "rgba(239,68,68,0.04)",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", flexShrink: 0 }}>
        <AlertTriangle style={{ width: "1rem", height: "1rem", color: "#dc2626" }} />
        <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "#dc2626" }}>
          Requiere atención
        </span>
      </span>

      <span style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {ordenados.map((item) => {
          const tono = TONES[item.tone];
          return (
            <Link
              key={item.href + item.one}
              href={item.href}
              style={{
                display: "inline-flex", alignItems: "baseline", gap: "0.35rem",
                padding: "0.3rem 0.7rem", borderRadius: "9999px",
                border: `1px solid ${tono.border}`, backgroundColor: tono.bg,
                textDecoration: "none", whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: tono.color, fontVariantNumeric: "tabular-nums" }}>
                {item.count}
              </span>
              <span style={{ fontSize: "0.8125rem", color: "var(--app-body-text)" }}>
                {item.count === 1 ? item.one : item.many}
              </span>
            </Link>
          );
        })}
      </span>
    </div>
  );
}
