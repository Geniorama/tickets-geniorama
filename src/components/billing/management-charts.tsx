"use client";

import { useState } from "react";
import { C, completo, corto } from "@/components/billing/chart-utils";

/**
 * Gráficos del tablero gerencial: SVG a mano, sin librerías.
 *
 * Reglas: marcas finas, un solo eje, texto en tinta de texto (nunca del color de
 * la serie), leyenda siempre visible con ≥2 series, y tooltip al pasar el cursor.
 */

const CATEGORICOS = [C.rosa, C.indigo, C.cian, C.ambar, C.verde, "#a855f7", "#64748b"];

function mesCorto(clave: string) {
  const [y, m] = clave.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: "short" });
}

const tarjeta: React.CSSProperties = {
  backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
  borderRadius: "0.75rem", padding: "1rem", position: "relative",
};
const tinta = "var(--app-body-text)";
const suave = "var(--app-text-muted)";

export function Panel({ titulo, nota, children }: { titulo: string; nota?: string; children: React.ReactNode }) {
  return (
    <div style={tarjeta}>
      <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: tinta, margin: 0 }}>{titulo}</p>
      {nota && <p style={{ fontSize: "0.7rem", color: suave, margin: "0.1rem 0 0.6rem" }}>{nota}</p>}
      {!nota && <div style={{ height: "0.6rem" }} />}
      {children}
    </div>
  );
}

function Leyenda({ items }: { items: { nombre: string; color: string }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 1rem", marginTop: "0.6rem" }}>
      {items.map((i) => (
        <span key={i.nombre} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.72rem", color: suave }}>
          <span style={{ width: "0.6rem", height: "0.6rem", borderRadius: "2px", backgroundColor: i.color }} />
          {i.nombre}
        </span>
      ))}
    </div>
  );
}

function Tip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div style={{
      position: "absolute", left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -110%)", pointerEvents: "none",
      backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.5rem",
      padding: "0.4rem 0.6rem", fontSize: "0.72rem", color: tinta, boxShadow: "0 4px 14px rgba(0,0,0,.18)", whiteSpace: "nowrap", zIndex: 5,
    }}>{children}</div>
  );
}

/** Ticks "bonitos" para un eje 0..max. */
function ticks(max: number, n = 4) {
  const paso = Math.pow(10, Math.floor(Math.log10(max / n || 1)));
  const f = [1, 2, 2.5, 5, 10].find((m) => (max / (paso * m)) <= n) ?? 10;
  const p = paso * f, top = Math.ceil(max / p) * p;
  return { top: top || 1, vals: Array.from({ length: Math.round(top / p) + 1 }, (_, i) => i * p) };
}

// ─── Líneas/áreas: facturado vs recaudado ────────────────────────────────────
export function AreaCompare({ datos }: { datos: { mes: string; a: number; b: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 220, L = 44, R = 12, T = 12, B = 26;
  const max = Math.max(...datos.flatMap((d) => [d.a, d.b]), 1);
  const { top, vals } = ticks(max);
  const x = (i: number) => L + (datos.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (datos.length - 1));
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const linea = (k: "a" | "b") => datos.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d[k])}`).join(" ");
  const area = (k: "a" | "b") => `${linea(k)} L${x(datos.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Facturado frente a recaudado por mes"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.min(datos.length - 1, Math.max(0, Math.round(((px - L) / (W - L - R)) * (datos.length - 1)))));
        }}>
        <defs>
          <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.rosa} stopOpacity=".28" /><stop offset="1" stopColor={C.rosa} stopOpacity="0" /></linearGradient>
          <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={C.verde} stopOpacity=".28" /><stop offset="1" stopColor={C.verde} stopOpacity="0" /></linearGradient>
        </defs>
        {vals.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--app-border)" strokeWidth="1" />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="9.5" fill="currentColor" style={{ color: suave }}>{corto(v)}</text>
          </g>
        ))}
        <path d={area("a")} fill="url(#gA)" /><path d={area("b")} fill="url(#gB)" />
        <path d={linea("a")} fill="none" stroke={C.rosa} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <path d={linea("b")} fill="none" stroke={C.verde} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {datos.map((d, i) => (
          <text key={d.mes} x={x(i)} y={H - 7} textAnchor="middle" fontSize="10" style={{ fill: "currentColor", color: suave }}>{mesCorto(d.mes)}</text>
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="var(--app-text-muted)" strokeDasharray="3 3" />
            <circle cx={x(hover)} cy={y(datos[hover].a)} r="5" fill={C.rosa} stroke="var(--app-card-bg)" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(datos[hover].b)} r="5" fill={C.verde} stroke="var(--app-card-bg)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <Tip x={(x(hover) / W) * 100} y={20}>
          <strong>{mesCorto(datos[hover].mes)}</strong><br />
          <span style={{ color: C.rosa }}>●</span> Facturado {completo(datos[hover].a)}<br />
          <span style={{ color: C.verde }}>●</span> Recaudado {completo(datos[hover].b)}
        </Tip>
      )}
      <Leyenda items={[{ nombre: "Facturado", color: C.rosa }, { nombre: "Recaudado", color: C.verde }]} />
    </div>
  );
}

// ─── Columnas: una serie por mes ─────────────────────────────────────────────
export function Columnas({ datos, color = C.indigo, nombre, cantidad = false }: { datos: { mes: string; v: number }[]; color?: string; nombre: string; cantidad?: boolean }) {
  const fmtC = (n: number) => (cantidad ? String(n) : corto(n));
  const fmtT = (n: number) => (cantidad ? String(n) : completo(n));
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 200, L = 44, R = 8, T = 12, B = 26;
  const { top, vals } = ticks(Math.max(...datos.map((d) => d.v), 1));
  const ancho = (W - L - R) / datos.length, barra = Math.min(ancho * 0.5, 44);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={nombre} onMouseLeave={() => setHover(null)}>
        {vals.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--app-border)" />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="9.5" style={{ fill: "currentColor", color: suave }}>{fmtC(v)}</text>
          </g>
        ))}
        {datos.map((d, i) => {
          const cx = L + ancho * i + ancho / 2, h = Math.max(y(0) - y(d.v), d.v > 0 ? 2 : 0);
          return (
            <g key={d.mes} onMouseEnter={() => setHover(i)}>
              <rect x={cx - ancho / 2} y={T} width={ancho} height={H - T - B} fill="transparent" />
              <rect x={cx - barra / 2} y={y(0) - h} width={barra} height={h} rx="4" fill={color} opacity={hover === null || hover === i ? 1 : 0.45} />
              <text x={cx} y={H - 7} textAnchor="middle" fontSize="10" style={{ fill: "currentColor", color: suave }}>{mesCorto(d.mes)}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tip x={((L + ancho * hover + ancho / 2) / W) * 100} y={25}><strong>{mesCorto(datos[hover].mes)}</strong><br />{fmtT(datos[hover].v)}</Tip>
      )}
    </div>
  );
}

// ─── Barras horizontales (ranking) ──────────────────────────────────────────
export function BarrasH({ filas, color = C.rosa, formato: modo = "pesos" }: {
  filas: { nombre: string; v: number; extra?: string }[]; color?: string; formato?: "pesos" | "numero";
}) {
  const formato = modo === "numero" ? (n: number) => String(n) : completo;
  const max = Math.max(...filas.map((f) => f.v), 1);
  if (filas.length === 0) return <p style={{ fontSize: "0.8rem", color: suave }}>Sin datos en el periodo.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {filas.map((f, i) => (
        <div key={f.nombre + i} title={`${f.nombre}: ${formato(f.v)}${f.extra ? ` · ${f.extra}` : ""}`}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", fontSize: "0.75rem", marginBottom: "0.2rem" }}>
            <span style={{ color: tinta, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre}</span>
            <span style={{ color: tinta, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{formato(f.v)}{f.extra && <span style={{ color: suave }}> · {f.extra}</span>}</span>
          </div>
          <div style={{ height: "0.55rem", backgroundColor: "var(--app-border)", borderRadius: "9999px", overflow: "hidden" }}>
            <div style={{ width: `${(f.v / max) * 100}%`, height: "100%", backgroundColor: color, borderRadius: "9999px" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Dona ────────────────────────────────────────────────────────────────────
export function Dona({ filas, centro, cantidad = false }: { filas: { nombre: string; v: number }[]; centro: string; cantidad?: boolean }) {
  const fmt = (n: number) => (cantidad ? String(n) : corto(n));
  const [hover, setHover] = useState<number | null>(null);
  const total = filas.reduce((s, f) => s + f.v, 0);
  if (total <= 0) return <p style={{ fontSize: "0.8rem", color: suave }}>Sin datos en el periodo.</p>;
  const R = 70, r = 46, cx = 90, cy = 90;
  const arcos = filas.map((f, i) => {
    const da = (f.v / total) * Math.PI * 2 * 0.999, a0 = -Math.PI / 2 + (filas.slice(0, i).reduce((t, x) => t + x.v, 0) / total) * Math.PI * 2, a1 = a0 + da;
    const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
    const grande = da > Math.PI ? 1 : 0;
    return { d: `M${p(R, a0)} A${R},${R} 0 ${grande} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${grande} 0 ${p(r, a0)} Z`, color: CATEGORICOS[i % CATEGORICOS.length], f };
  });
  const act = hover === null ? null : filas[hover];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "1rem" }}>
      <svg viewBox="0 0 180 180" width="170" height="170" role="img" aria-label="Distribución" onMouseLeave={() => setHover(null)}>
        {arcos.map((a, i) => (
          <path key={a.f.nombre} d={a.d} fill={a.color} stroke="var(--app-card-bg)" strokeWidth="2" onMouseEnter={() => setHover(i)}
            opacity={hover === null || hover === i ? 1 : 0.4} />
        ))}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="15" fontWeight="700" style={{ fill: "currentColor", color: tinta }}>{act ? `${((act.v / total) * 100).toFixed(0)} %` : fmt(total)}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9.5" style={{ fill: "currentColor", color: suave }}>{act ? fmt(act.v) : centro}</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: "1 1 8rem", minWidth: 0 }}>
        {filas.map((f, i) => (
          <span key={f.nombre} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.75rem", color: tinta }}>
            <span style={{ width: "0.6rem", height: "0.6rem", borderRadius: "2px", backgroundColor: CATEGORICOS[i % CATEGORICOS.length], flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.nombre}</span>
            <span style={{ color: suave, fontVariantNumeric: "tabular-nums" }}>{((f.v / total) * 100).toFixed(0)} %</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Embudo del pipeline ────────────────────────────────────────────────────
export function Embudo({ etapas }: { etapas: { nombre: string; cantidad: number; valor: number }[] }) {
  const max = Math.max(...etapas.map((e) => e.valor), 1);
  const tonos = [C.gris, C.cian, C.indigo, C.rosa];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", alignItems: "center" }}>
      {etapas.map((e, i) => (
        <div key={e.nombre} title={`${e.nombre}: ${completo(e.valor)} (${e.cantidad})`}
          style={{ width: `${Math.max((e.valor / max) * 100, 22)}%`, backgroundColor: tonos[i % tonos.length], color: "#fff", borderRadius: "0.5rem", padding: "0.5rem 0.75rem", display: "flex", justifyContent: "space-between", gap: "0.5rem", fontSize: "0.75rem", fontWeight: 600 }}>
          <span>{e.nombre} · {e.cantidad}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{corto(e.valor)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Anillo de porcentaje ───────────────────────────────────────────────────
export function Anillo({ pct, etiqueta, color = C.verde }: { pct: number | null; etiqueta: string; color?: string }) {
  const r = 42, c = 2 * Math.PI * r, p = Math.min(Math.max(pct ?? 0, 0), 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
      <svg viewBox="0 0 110 110" width="110" height="110" role="img" aria-label={`${etiqueta}: ${pct === null ? "sin datos" : p.toFixed(0) + " %"}`}>
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--app-border)" strokeWidth="10" />
        <circle cx="55" cy="55" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 55 55)" />
        <text x="55" y="60" textAnchor="middle" fontSize="20" fontWeight="700" style={{ fill: "currentColor", color: tinta }}>{pct === null ? "—" : `${p.toFixed(0)}%`}</text>
      </svg>
      <span style={{ fontSize: "0.75rem", color: suave, maxWidth: "9rem" }}>{etiqueta}</span>
    </div>
  );
}

// ─── Barra segmentada (cartera vigente vs vencida) ──────────────────────────
export function Segmentada({ partes }: { partes: { nombre: string; v: number; color: string }[] }) {
  const total = partes.reduce((s, p) => s + p.v, 0);
  if (total <= 0) return <p style={{ fontSize: "0.8rem", color: suave }}>No hay cartera pendiente.</p>;
  return (
    <div>
      <div style={{ display: "flex", gap: "2px", height: "1.6rem" }}>
        {partes.filter((p) => p.v > 0).map((p) => (
          <div key={p.nombre} title={`${p.nombre}: ${completo(p.v)}`}
            style={{ width: `${(p.v / total) * 100}%`, backgroundColor: p.color, borderRadius: "4px" }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 1.25rem", marginTop: "0.6rem" }}>
        {partes.map((p) => (
          <span key={p.nombre} style={{ fontSize: "0.75rem", color: tinta }}>
            <span style={{ color: p.color }}>●</span> {p.nombre}: <strong>{completo(p.v)}</strong>
            <span style={{ color: suave }}> ({((p.v / total) * 100).toFixed(0)} %)</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Cascada: ingresos → utilidad ───────────────────────────────────────────
export function Cascada({ ingresos, personal, proveedores, operacion }: { ingresos: number; personal: number; proveedores: number; operacion: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const margen = ingresos - personal - proveedores, utilidad = margen - operacion;
  // [etiqueta, desde, hasta, color]
  const pasos: [string, number, number, string][] = [
    ["Ingresos", 0, ingresos, C.indigo],
    ["Personal", ingresos, ingresos - personal, C.gris],
    ["Proveedores", ingresos - personal, margen, C.gris],
    ["Margen bruto", 0, margen, margen >= 0 ? C.verde : C.rojo],
    ["Operación", margen, utilidad, C.gris],
    ["Utilidad", 0, utilidad, utilidad >= 0 ? C.verde : C.rojo],
  ];
  const W = 560, H = 230, L = 44, R = 8, T = 14, B = 34;
  const lo = Math.min(0, ...pasos.flatMap((p) => [p[1], p[2]])), hi = Math.max(1, ...pasos.flatMap((p) => [p[1], p[2]]));
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const ancho = (W - L - R) / pasos.length, barra = Math.min(ancho * 0.55, 52);
  const { vals } = ticks(hi);
  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Cascada de ingresos a utilidad operativa" onMouseLeave={() => setHover(null)}>
        {vals.filter((v) => v >= lo && v <= hi).map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--app-border)" />
            <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize="9.5" style={{ fill: "currentColor", color: suave }}>{corto(v)}</text>
          </g>
        ))}
        {pasos.map(([nombre, d, h, color], i) => {
          const cx = L + ancho * i + ancho / 2, y0 = y(Math.max(d, h)), alto = Math.max(Math.abs(y(d) - y(h)), 2);
          return (
            <g key={nombre} onMouseEnter={() => setHover(i)}>
              <rect x={cx - ancho / 2} y={T} width={ancho} height={H - T - B} fill="transparent" />
              <rect x={cx - barra / 2} y={y0} width={barra} height={alto} rx="4" fill={color} opacity={hover === null || hover === i ? 1 : 0.5} />
              <text x={cx} y={H - 16} textAnchor="middle" fontSize="10" style={{ fill: "currentColor", color: suave }}>{nombre}</text>
              <text x={cx} y={H - 4} textAnchor="middle" fontSize="10" fontWeight="600" style={{ fill: "currentColor", color: tinta }}>{corto(i === 1 || i === 2 || i === 4 ? -Math.abs(d - h) : h)}</text>
            </g>
          );
        })}
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--app-text-muted)" />
      </svg>
      {hover !== null && (
        <Tip x={((L + ancho * hover + ancho / 2) / W) * 100} y={22}>
          <strong>{pasos[hover][0]}</strong><br />{completo(hover === 1 || hover === 2 || hover === 4 ? Math.abs(pasos[hover][1] - pasos[hover][2]) : pasos[hover][2])}
        </Tip>
      )}
    </div>
  );
}
