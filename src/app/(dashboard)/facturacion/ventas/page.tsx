import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCan } from "@/lib/access/can";
import { formatAmount } from "@/lib/money";
import { formatDate } from "@/lib/format-date";
import { periodoDesdeParams } from "@/lib/billing/categories";
import { oportunidadesGanadas, ventasPorEmpresa, ventasPorMes } from "@/lib/billing/sales";

export const metadata = { title: "Ventas" };

const comoInput = (d: Date) => d.toISOString().slice(0, 10);

const celda: React.CSSProperties = { padding: "0.55rem 0.75rem", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" };
const cabecera: React.CSSProperties = { ...celda, fontSize: "0.7rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" };
const num: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };
const tarjeta: React.CSSProperties = {
  backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
  borderRadius: "0.75rem", overflowX: "auto",
};
const inputFecha: React.CSSProperties = {
  padding: "0.45rem 0.6rem", fontSize: "0.8125rem", borderRadius: "0.5rem",
  border: "1px solid var(--app-border)", backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
};

function mesLegible(clave: string) {
  const [y, m] = clave.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
}

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireCan("FACTURACION", "ver");
  const { desde, hasta } = await searchParams;
  const periodo = periodoDesdeParams(desde, hasta);

  const [filas, meses, ganadas] = await Promise.all([
    ventasPorEmpresa(periodo),
    ventasPorMes(periodo.hasta),
    oportunidadesGanadas(periodo),
  ]);

  const suma = (k: "facturas" | "cuentasCobro" | "total" | "cobrado" | "porCobrar") =>
    filas.reduce((s, f) => s + f[k], 0);
  const maxMes = Math.max(...meses.map((m) => m.facturas + m.cuentasCobro), 1);
  const sinCobro = ganadas.filter((g) => g.documentos === 0);

  const resumen = [
    { etiqueta: "Vendido", valor: suma("total") },
    { etiqueta: "Facturas", valor: suma("facturas") },
    { etiqueta: "Cuentas de cobro", valor: suma("cuentasCobro") },
    { etiqueta: "Cobrado", valor: suma("cobrado") },
    { etiqueta: "Por cobrar", valor: suma("porCobrar") },
  ];

  return (
    <div>
      <Link
        href="/facturacion"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", color: "var(--app-text-muted)", textDecoration: "none", marginBottom: "1rem" }}
      >
        <ArrowLeft style={{ width: "1rem", height: "1rem" }} />
        Volver
      </Link>

      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>Ventas</h1>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.25rem", marginBottom: "1.25rem" }}>
        Facturas y cuentas de cobro emitidas entre el {formatDate(periodo.desde)} y el {formatDate(periodo.hasta)}.
        Los importes incluyen IVA cuando lo hay.
      </p>

      <form method="get" style={{ display: "flex", alignItems: "flex-end", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <div>
          <label htmlFor="desde" style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginBottom: "0.2rem" }}>Desde</label>
          <input id="desde" name="desde" type="date" defaultValue={comoInput(periodo.desde)} style={inputFecha} />
        </div>
        <div>
          <label htmlFor="hasta" style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginBottom: "0.2rem" }}>Hasta</label>
          <input id="hasta" name="hasta" type="date" defaultValue={comoInput(periodo.hasta)} style={inputFecha} />
        </div>
        <button
          type="submit"
          style={{ padding: "0.45rem 0.9rem", fontSize: "0.8125rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#fd1384", color: "#fff", cursor: "pointer" }}
        >
          Ver
        </button>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))", gap: "0.75rem", marginBottom: "1.75rem" }}>
        {resumen.map((r) => (
          <div key={r.etiqueta} style={{ ...tarjeta, padding: "0.85rem 1rem" }}>
            <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", margin: 0 }}>{r.etiqueta}</p>
            <p style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--app-body-text)", margin: "0.2rem 0 0", fontVariantNumeric: "tabular-nums" }}>
              {formatAmount(r.valor)}
            </p>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.6rem" }}>Últimos meses</h2>
      <div style={{ ...tarjeta, padding: "1rem", marginBottom: "1.75rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {meses.map((m) => (
            <div key={m.mes} style={{ display: "grid", gridTemplateColumns: "4rem 1fr auto", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>{mesLegible(m.mes)}</span>
              <div style={{ height: "0.6rem", display: "flex", borderRadius: "9999px", backgroundColor: "var(--app-border)", overflow: "hidden" }}>
                <div style={{ width: `${(m.facturas / maxMes) * 100}%`, backgroundColor: "#fd1384" }} title={`Facturas ${formatAmount(m.facturas)}`} />
                <div style={{ width: `${(m.cuentasCobro / maxMes) * 100}%`, backgroundColor: "#6366f1" }} title={`Cuentas de cobro ${formatAmount(m.cuentasCobro)}`} />
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--app-body-text)", fontVariantNumeric: "tabular-nums" }}>
                {formatAmount(m.facturas + m.cuentasCobro)}
              </span>
            </div>
          ))}
        </div>
        <p style={{ fontSize: "0.7rem", color: "var(--app-text-muted)", marginTop: "0.75rem", display: "flex", gap: "1rem" }}>
          <span><span style={{ color: "#fd1384" }}>●</span> Facturas</span>
          <span><span style={{ color: "#6366f1" }}>●</span> Cuentas de cobro</span>
        </p>
      </div>

      <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.6rem" }}>Por empresa</h2>
      {filas.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1.75rem" }}>No se emitió nada en ese periodo.</p>
      ) : (
        <div style={{ ...tarjeta, marginBottom: "1.75rem" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "40rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--app-border)" }}>
                <th style={{ ...cabecera, textAlign: "left" }}>Empresa</th>
                <th style={{ ...cabecera, ...num }}>Facturas</th>
                <th style={{ ...cabecera, ...num }}>Cuentas de cobro</th>
                <th style={{ ...cabecera, ...num }}>Total</th>
                <th style={{ ...cabecera, ...num }}>Cobrado</th>
                <th style={{ ...cabecera, ...num }}>Por cobrar</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.companyId} style={{ borderBottom: "1px solid var(--app-border)" }}>
                  <td style={{ ...celda, color: "var(--app-body-text)", fontWeight: 500 }}>
                    <Link href={`/crm/${f.companyId}`} style={{ color: "inherit", textDecoration: "none" }}>{f.empresa}</Link>
                    <span style={{ color: "var(--app-text-muted)", fontWeight: 400 }}> · {f.documentos}</span>
                  </td>
                  <td style={{ ...celda, ...num }}>{formatAmount(f.facturas)}</td>
                  <td style={{ ...celda, ...num }}>{formatAmount(f.cuentasCobro)}</td>
                  <td style={{ ...celda, ...num, fontWeight: 600, color: "var(--app-body-text)" }}>{formatAmount(f.total)}</td>
                  <td style={{ ...celda, ...num }}>{formatAmount(f.cobrado)}</td>
                  <td style={{ ...celda, ...num, color: f.porCobrar > 0 ? "var(--tone-amber-fg)" : undefined }}>{formatAmount(f.porCobrar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.25rem" }}>Oportunidades ganadas</h2>
      <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginBottom: "0.6rem" }}>
        Las que se cerraron como ganadas en el periodo, contra lo que ya se cobró por ellas.
        {sinCobro.length > 0 && ` ${sinCobro.length} sin ningún cobro vinculado.`}
      </p>
      {ganadas.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>No se ganó ninguna en ese periodo.</p>
      ) : (
        <div style={tarjeta}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "36rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--app-border)" }}>
                <th style={{ ...cabecera, textAlign: "left" }}>Oportunidad</th>
                <th style={{ ...cabecera, ...num }}>Valor</th>
                <th style={{ ...cabecera, ...num }}>Cobros</th>
                <th style={{ ...cabecera, ...num }}>Cobrado</th>
              </tr>
            </thead>
            <tbody>
              {ganadas.map((g) => (
                <tr key={g.id} style={{ borderBottom: "1px solid var(--app-border)" }}>
                  <td style={{ ...celda, color: "var(--app-body-text)" }}>
                    <Link href={`/crm/oportunidades/${g.id}`} style={{ color: "inherit", textDecoration: "none", fontWeight: 500 }}>{g.titulo}</Link>
                    <span style={{ color: "var(--app-text-muted)" }}> · {g.empresa}</span>
                  </td>
                  <td style={{ ...celda, ...num }}>{g.valor != null ? formatAmount(g.valor) : "—"}</td>
                  <td style={{ ...celda, ...num, color: g.documentos === 0 ? "var(--tone-amber-fg)" : undefined }}>
                    {g.documentos === 0 ? "Sin cobro" : g.documentos}
                  </td>
                  <td style={{ ...celda, ...num }}>{formatAmount(g.cobrado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
