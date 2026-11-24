import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCan } from "@/lib/access/can";
import { formatAmount } from "@/lib/money";
import { formatDate } from "@/lib/format-date";
import { periodoDesdeParams } from "@/lib/billing/categories";
import { corto } from "@/components/billing/management-charts";
import { AreaCompare, Columnas, BarrasH, Dona, Embudo, Anillo, Segmentada, Cascada, Panel, C } from "@/components/billing/management-charts";
import { cargarTableroGerencial } from "@/lib/management/dashboard";

export const metadata = { title: "Tablero gerencial" };

const $ = (n: number | null | undefined) => formatAmount(n ?? 0) ?? "—";
const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(1)} %`);
const comoInput = (d: Date) => d.toISOString().slice(0, 10);
const ETAPAS: Record<string, string> = { NUEVA: "Nueva", CONTACTADA: "Contactada", PROPUESTA: "Propuesta", NEGOCIACION: "Negociación" };

const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(22rem, 1fr))", gap: "0.85rem", marginTop: "0.5rem" };
const celda: React.CSSProperties = { padding: "0.5rem 0.75rem", fontSize: "0.8125rem", fontVariantNumeric: "tabular-nums" };
const cabecera: React.CSSProperties = { ...celda, fontSize: "0.7rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" };
const num: React.CSSProperties = { textAlign: "right", whiteSpace: "nowrap" };
const tarjeta: React.CSSProperties = { backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", overflowX: "auto" };
const inputFecha: React.CSSProperties = { padding: "0.45rem 0.6rem", fontSize: "0.8125rem", borderRadius: "0.5rem", border: "1px solid var(--app-border)", backgroundColor: "var(--app-bg)", color: "var(--app-body-text)" };

function Seccion({ letra, titulo, children }: { letra: string; titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: "2.25rem" }}>
      <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "0.75rem" }}>
        <span style={{ color: "#fd1384" }}>{letra}.</span> {titulo}
      </h2>
      {children}
    </section>
  );
}

function Kpis({ items }: { items: { etiqueta: string; valor: string; nota?: string; alerta?: boolean }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
      {items.map((k) => (
        <div key={k.etiqueta} style={{ ...tarjeta, padding: "0.85rem 1rem" }}>
          <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", margin: 0 }}>{k.etiqueta}</p>
          <p style={{ fontSize: "1.2rem", fontWeight: 700, margin: "0.2rem 0 0", fontVariantNumeric: "tabular-nums", color: k.alerta ? "#dc2626" : "var(--app-body-text)" }}>{k.valor}</p>
          {k.nota && <p style={{ fontSize: "0.7rem", color: "var(--app-text-muted)", margin: "0.15rem 0 0" }}>{k.nota}</p>}
        </div>
      ))}
    </div>
  );
}

function Tabla({ cols, filas, vacio }: { cols: string[]; filas: (string | number)[][]; vacio: string }) {
  if (filas.length === 0) return <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>{vacio}</p>;
  return (
    <div style={tarjeta}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "22rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--app-border)" }}>
            {cols.map((c, i) => <th key={c} style={{ ...cabecera, ...(i === 0 ? { textAlign: "left" } : num) }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--app-border)" }}>
              {f.map((v, j) => <td key={j} style={{ ...celda, ...(j === 0 ? { color: "var(--app-body-text)", fontWeight: 500 } : { ...num, color: "var(--app-body-text)" }) }}>{v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Subtitulo({ children }: { children: React.ReactNode }) {
  return <h3 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "1.25rem 0 0.5rem" }}>{children}</h3>;
}

export default async function GerencialPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireCan("FACTURACION", "gestionar");
  const { desde, hasta } = await searchParams;
  const periodo = periodoDesdeParams(desde, hasta);
  const t = await cargarTableroGerencial(periodo);
  const { resumen: r, financiero: f, comercial: c, rentabilidad: g } = t;

  return (
    <div>
      <Link href="/facturacion" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", color: "var(--app-text-muted)", textDecoration: "none", marginBottom: "1rem" }}>
        <ArrowLeft style={{ width: "1rem", height: "1rem" }} /> Volver
      </Link>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.75rem", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>Tablero gerencial</h1>
          <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", margin: "0.25rem 0 1.25rem" }}>
            Periodo: {formatDate(periodo.desde)} al {formatDate(periodo.hasta)}. La cartera y el pipeline se muestran a hoy.
          </p>
        </div>
        <Link href="/facturacion/gerencial/costos" style={{ fontSize: "0.8125rem", padding: "0.45rem 0.85rem", borderRadius: "0.5rem", border: "1px solid var(--app-border)", color: "var(--app-nav-text)", textDecoration: "none" }}>
          Registrar costos
        </Link>
      </div>

      <form method="get" style={{ display: "flex", alignItems: "flex-end", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1.75rem" }}>
        <label style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>Desde<br /><input name="desde" type="date" defaultValue={comoInput(periodo.desde)} style={inputFecha} /></label>
        <label style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>Hasta<br /><input name="hasta" type="date" defaultValue={comoInput(periodo.hasta)} style={inputFecha} /></label>
        <button type="submit" style={{ padding: "0.45rem 0.9rem", fontSize: "0.8125rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#fd1384", color: "#fff", cursor: "pointer" }}>Ver</button>
      </form>

      <Seccion letra="A" titulo="Resumen ejecutivo">
        <Kpis items={[
          { etiqueta: "Ventas ganadas", valor: $(r.ventasGanadas), nota: `${r.oportunidadesGanadas} oportunidades` },
          { etiqueta: "Facturación emitida", valor: $(r.facturacionEmitida), nota: `${r.documentosEmitidos} documentos, con IVA` },
          { etiqueta: "Recaudo efectivo", valor: $(r.recaudo), nota: "Abonos recibidos en el periodo" },
          { etiqueta: "Cartera pendiente", valor: $(r.carteraPendiente), nota: `${f.cobrosPendientes} cobros` },
          { etiqueta: "Cartera vencida", valor: $(r.carteraVencida), nota: `${f.cobrosVencidos} cobros`, alerta: r.carteraVencida > 0 },
          { etiqueta: "Pipeline comercial", valor: $(r.pipelineValor), nota: `${r.oportunidadesAbiertas} abiertas · ponderado ${$(r.pipelinePonderado)}` },
        ]} />
        <div style={grid}>
          <Panel titulo="Salud de la cartera" nota="Saldo por cobrar, vigente frente a vencido">
            <Segmentada partes={[{ nombre: "Vigente", v: r.carteraPendiente - r.carteraVencida, color: C.verde }, { nombre: "Vencida", v: r.carteraVencida, color: C.rojo }]} />
          </Panel>
          <Panel titulo="Del pipeline al dinero" nota="Pipeline abierto → ventas ganadas → facturado → recaudado">
            <BarrasH formato={$} filas={[
              { nombre: "Pipeline abierto", v: r.pipelineValor },
              { nombre: "Ventas ganadas", v: r.ventasGanadas },
              { nombre: "Facturación emitida", v: r.facturacionEmitida },
              { nombre: "Recaudo efectivo", v: r.recaudo },
            ]} />
          </Panel>
        </div>
      </Seccion>

      <Seccion letra="B" titulo="Control financiero">
        <Kpis items={[
          { etiqueta: "Anticipos recibidos", valor: $(f.anticipos), nota: `${f.anticiposCobros} cobros aún sin facturar` },
          { etiqueta: "Facturación pendiente", valor: $(f.facturacionPendiente), nota: `Por facturar ${$(f.porFacturar)} · Backlog ${$(f.backlog)}` },
          { etiqueta: "Cobros pendientes", valor: String(f.cobrosPendientes) },
          { etiqueta: "Cobros vencidos", valor: String(f.cobrosVencidos), alerta: f.cobrosVencidos > 0 },
        ]} />
        <div style={grid}>
          <Panel titulo="Facturado vs. recaudado" nota="Últimos 6 meses, con IVA. Pasa el cursor para ver el detalle">
            <AreaCompare datos={f.serie.map((m) => ({ mes: m.mes, a: m.facturado, b: m.recaudado }))} />
          </Panel>
          <Panel titulo="Ingresos por categoría" nota="Base sin IVA del periodo">
            <Dona centro="facturado" filas={f.porCategoria.map((x) => ({ nombre: x.nombre, v: x.base }))} />
          </Panel>
          <Panel titulo="Ingresos por cliente" nota="Facturado en el periodo, los 8 mayores">
            <BarrasH filas={f.porEmpresa.map((e) => ({ nombre: e.empresa, v: e.total, extra: `cobrado ${corto(e.cobrado)}` }))} />
          </Panel>
        </div>
        <Subtitulo>Mayores cobros vencidos</Subtitulo>
        <Tabla cols={["Cliente", "Factura", "Venció", "Saldo"]} vacio="No hay cartera vencida."
          filas={f.mayoresVencidos.map((v) => [v.company.name, v.invoiceNumber ?? v.concept, v.invoiceDueDate ? formatDate(v.invoiceDueDate) : "—", $(v.saldo)])} />
      </Seccion>

      <Seccion letra="C" titulo="Rendimiento comercial">
        <Kpis items={[
          { etiqueta: "Ganadas / perdidas", valor: `${c.ganadas} / ${c.perdidas}` },
          { etiqueta: "Conversión comercial", valor: pct(c.conversion), nota: "Ganadas sobre cerradas del periodo" },
          { etiqueta: "Valor promedio por venta", valor: c.promedio === null ? "—" : $(c.promedio) },
          { etiqueta: "Proyección de cierre (30 días)", valor: $(c.proyeccion30d), nota: `${c.oportunidadesCierranPronto} con fecha próxima · ${c.sinFecha} sin fecha` },
        ]} />
        <div style={grid}>
          <Panel titulo="Ventas ganadas por mes" nota="Valor de las oportunidades ganadas">
            <Columnas nombre="Ventas ganadas por mes" datos={f.serie.map((m) => ({ mes: m.mes, v: m.ventas }))} />
          </Panel>
          <Panel titulo="Conversión comercial" nota="Ganadas sobre cerradas en el periodo">
            <Anillo pct={c.conversion} etiqueta={`${c.ganadas} ganadas, ${c.perdidas} perdidas`} />
          </Panel>
          <Panel titulo="Embudo del pipeline" nota="Valor abierto por etapa">
            <Embudo etapas={c.porEtapa.map((e) => ({ nombre: ETAPAS[e.etapa], cantidad: e.cantidad, valor: e.valor }))} />
          </Panel>
          <Panel titulo="Ventas por cliente">
            <BarrasH color={C.indigo} filas={c.porCliente.map((x) => ({ nombre: x.nombre, v: x.valor, extra: `${x.cantidad}` }))} />
          </Panel>
          <Panel titulo="Ventas por responsable">
            <BarrasH color={C.cian} filas={c.porResponsable.map((x) => ({ nombre: x.nombre, v: x.valor, extra: `${x.cantidad}` }))} />
          </Panel>
        </div>
      </Seccion>

      <Seccion letra="D" titulo="Rentabilidad">
        <Kpis items={[
          { etiqueta: "Ingresos (base sin IVA)", valor: $(g.ingresosBase) },
          { etiqueta: "Margen bruto", valor: $(g.margenBruto), nota: `${pct(g.margenBrutoPct)} · ingresos − personal − proveedores`, alerta: g.margenBruto < 0 },
          { etiqueta: "Utilidad operativa", valor: $(g.utilidadOperativa), nota: `${pct(g.utilidadPct)} · margen − operación`, alerta: g.utilidadOperativa < 0 },
          { etiqueta: "Costos totales", valor: $(g.costoTotal) },
        ]} />
        <div style={grid}>
          <Panel titulo="De ingresos a utilidad operativa" nota="Cascada del periodo, base sin IVA">
            <Cascada ingresos={g.ingresosBase} personal={g.costoPersonal} proveedores={g.costoProveedores} operacion={g.costoOperacion} />
          </Panel>
          <Panel titulo="Ingresos por servicio" nota="Categoría de facturación">
            <Dona centro="facturado" filas={g.porServicio.map((x) => ({ nombre: x.nombre, v: x.base }))} />
          </Panel>
        </div>
        {g.costoTotal === 0 && (
          <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginTop: "0.6rem" }}>
            No hay costos registrados en este periodo, así que el margen y la utilidad equivalen a los ingresos. <Link href="/facturacion/gerencial/costos" style={{ color: "#fd1384" }}>Regístralos aquí</Link>.
          </p>
        )}
      </Seccion>
    </div>
  );
}
