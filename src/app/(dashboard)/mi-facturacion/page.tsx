import { CreditCard } from "lucide-react";
import { requireCan } from "@/lib/access/can";
import { facturasDeCliente, type EstadoFactura, type FacturaDeCliente } from "@/lib/billing/portal";
import { formatAmount } from "@/lib/money";
import { formatDate } from "@/lib/format-date";

/**
 * «Mi facturación»: lo que un cliente autorizado ve de sus propias facturas.
 *
 * Solo lectura. Lo único que se puede hacer desde aquí es pagar, y eso ocurre
 * en la página pública del link, no en esta.
 */

export const metadata = { title: "Mi facturación" };

const ESTADO: Record<EstadoFactura, { label: string; color: string }> = {
  PENDIENTE: { label: "Pendiente", color: "#b45309" },
  ABONADA:   { label: "Abonada",   color: "#2563eb" },
  PAGADA:    { label: "Pagada",    color: "#16a34a" },
};

const card: React.CSSProperties = {
  backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
  borderRadius: "0.75rem", padding: "1.25rem",
};
const muted: React.CSSProperties = { fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: 0 };

export default async function MiFacturacionPage() {
  // `requireCan` y no el rol: este módulo lo autoriza un administrador a cada
  // cliente. El techo del rol lo pone `allowedRoles`, así que el equipo no
  // entra aquí — tiene Facturación.
  const session = await requireCan("PORTAL_FACTURACION", "ver");

  const facturas = await facturasDeCliente(session.user.id);
  const pendientes = facturas.filter((f) => f.estado !== "PAGADA");
  const pagadas = facturas.filter((f) => f.estado === "PAGADA");
  const porPagar = pendientes.reduce((s, f) => s + f.falta, 0);
  const variasEmpresas = new Set(facturas.map((f) => f.company)).size > 1;

  return (
    <div className="max-w-4xl">
      <h1 data-tour-id="page-title" style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
        Mi facturación
      </h1>
      <p style={{ ...muted, fontSize: "0.875rem", marginTop: "0.2rem", marginBottom: "1.25rem" }}>
        Tus facturas con Geniorama: lo que está pendiente y lo que ya pagaste.
      </p>

      {facturas.length === 0 ? (
        <div style={card}>
          <p style={{ ...muted, fontSize: "0.875rem" }}>Todavía no tienes facturas.</p>
        </div>
      ) : (
        <>
          <div style={{ ...card, marginBottom: "1.25rem" }}>
            <p style={muted}>Por pagar</p>
            <p style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--app-body-text)", margin: "0.1rem 0 0" }}>
              {formatAmount(porPagar) ?? "$ 0"}
            </p>
            <p style={{ ...muted, marginTop: "0.25rem" }}>
              {pendientes.length === 0
                ? "Estás al día. ¡Gracias!"
                : `En ${pendientes.length} ${pendientes.length === 1 ? "factura pendiente" : "facturas pendientes"}.`}
            </p>
          </div>

          <Seccion titulo="Pendientes" vacio="No tienes facturas pendientes." facturas={pendientes} variasEmpresas={variasEmpresas} />
          <Seccion titulo="Pagadas" vacio="Aún no hay facturas pagadas." facturas={pagadas} variasEmpresas={variasEmpresas} />
        </>
      )}
    </div>
  );
}

function Seccion({
  titulo, vacio, facturas, variasEmpresas,
}: {
  titulo: string;
  vacio: string;
  facturas: FacturaDeCliente[];
  variasEmpresas: boolean;
}) {
  return (
    <section style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "0.8125rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--app-text-muted)", marginBottom: "0.6rem" }}>
        {titulo} ({facturas.length})
      </h2>
      {facturas.length === 0 ? (
        <p style={{ ...muted, fontSize: "0.875rem" }}>{vacio}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {facturas.map((f) => <Factura key={f.id} f={f} conEmpresa={variasEmpresas} />)}
        </div>
      )}
    </section>
  );
}

function Factura({ f, conEmpresa }: { f: FacturaDeCliente; conEmpresa: boolean }) {
  const e = ESTADO[f.estado];
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ minWidth: 0, flex: "1 1 16rem" }}>
          <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)", margin: 0 }}>{f.concept}</p>
          <p style={{ ...muted, marginTop: "0.2rem" }}>
            {[
              conEmpresa ? f.company : null,
              f.invoiceNumber ? `Factura ${f.invoiceNumber}` : null,
              f.invoicedAt ? `Emitida el ${formatDate(f.invoicedAt)}` : null,
            ].filter(Boolean).join(" · ") || "Factura"}
          </p>
          {f.estado !== "PAGADA" && f.invoiceDueDate && (
            <p style={{ ...muted, marginTop: "0.2rem", color: f.vencida ? "#dc2626" : "var(--app-text-muted)", fontWeight: f.vencida ? 600 : 400 }}>
              {f.vencida ? "Venció" : "Vence"} el {formatDate(f.invoiceDueDate)}
            </p>
          )}
          {f.estado === "PAGADA" && f.paidAt && (
            <p style={{ ...muted, marginTop: "0.2rem" }}>Pagada el {formatDate(f.paidAt)}</p>
          )}
        </div>

        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "0.6875rem", fontWeight: 600, padding: "0.15rem 0.5rem", borderRadius: "9999px", backgroundColor: `${e.color}1a`, color: e.color }}>
            {e.label}
          </span>
          <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--app-body-text)", margin: "0.35rem 0 0" }}>
            {formatAmount(f.estado === "PAGADA" ? f.total : f.falta)}
          </p>
          {f.estado === "ABONADA" && (
            <p style={muted}>de {formatAmount(f.total)} · abonado {formatAmount(f.pagado)}</p>
          )}
        </div>
      </div>

      {f.abonos.length > 0 && (
        <div style={{ marginTop: "0.85rem", paddingTop: "0.7rem", borderTop: "1px solid var(--app-border)" }}>
          <p style={{ ...muted, fontSize: "0.75rem", fontWeight: 600, marginBottom: "0.25rem" }}>
            {f.abonos.length === 1 ? "Pago recibido" : "Pagos recibidos"}
          </p>
          {f.abonos.map((a, i) => (
            <p key={i} style={muted}>
              {formatAmount(a.amount)} · {formatDate(a.paidOn)}{a.method ? ` · ${a.method}` : ""}
            </p>
          ))}
        </div>
      )}

      {f.linkPago && (
        <div style={{ marginTop: "0.9rem" }}>
          <a
            href={f.linkPago}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              backgroundColor: "#fd1384", color: "#ffffff", borderRadius: "0.5rem",
              padding: "0.55rem 1.1rem", fontSize: "0.875rem", fontWeight: 600, textDecoration: "none",
            }}
          >
            <CreditCard style={{ width: "0.95rem", height: "0.95rem" }} />
            Pagar en línea {formatAmount(f.falta)}
          </a>
        </div>
      )}
    </div>
  );
}
