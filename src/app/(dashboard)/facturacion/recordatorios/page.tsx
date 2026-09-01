import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import type { ReminderChannel } from "@/generated/prisma";
import { canalDisponible } from "@/lib/billing/reminders/channels";
import { CHANNEL_LABELS } from "@/lib/billing/reminders/labels";
import { ReminderRules, type Regla } from "@/components/billing/reminder-rules";
import { formatDateTimeLong } from "@/lib/format-date";

export const metadata = { title: "Recordatorios de cobro" };

const CANALES: ReminderChannel[] = ["EMAIL", "SMS", "WHATSAPP"];

export default async function RecordatoriosPage() {
  // Configurar recordatorios no es editar un cobro: decide qué se le dice a un
  // cliente y cuándo, sin que nadie lo vuelva a mirar.
  await requireCan("FACTURACION", "gestionar");

  const [reglas, ultimos, sinVencimiento] = await Promise.all([
    prisma.billingReminderRule.findMany({
      orderBy: { offsetDays: "asc" },
      include: { _count: { select: { sent: { where: { status: "SENT" } } } } },
    }),
    prisma.billingReminder.findMany({
      orderBy: { sentAt: "desc" },
      take: 15,
      select: {
        id: true, channel: true, status: true, recipient: true, recipientName: true,
        error: true, sentAt: true,
        billingItem: { select: { id: true, concept: true, company: { select: { name: true } } } },
      },
    }),
    // Una factura emitida sin fecha de vencimiento no entra en ninguna regla.
    // Es el fallo silencioso de todo esto, así que se cuenta y se dice.
    prisma.billingItem.count({
      where: { status: { in: ["FACTURADO", "ABONADO"] }, invoiceDueDate: null },
    }),
  ]);

  const canalesListos = CANALES.filter(canalDisponible);
  const sinConectar = CANALES.filter((c) => !canalesListos.includes(c));

  const paraElCliente: Regla[] = reglas.map((r) => ({
    id: r.id,
    name: r.name,
    offsetDays: r.offsetDays,
    channels: r.channels,
    subject: r.subject,
    body: r.body,
    isActive: r.isActive,
    enviados: r._count.sent,
  }));

  return (
    <div>
      <Link
        href="/facturacion"
        style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", color: "var(--app-text-muted)", textDecoration: "none", marginBottom: "1rem" }}
      >
        <ArrowLeft style={{ width: "1rem", height: "1rem" }} />
        Volver
      </Link>

      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
        Recordatorios de cobro
      </h1>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.25rem", maxWidth: "44rem" }}>
        Cada mañana se revisan las facturas emitidas que siguen sin cobrarse y se
        manda lo que toque según estas reglas. Un cobro solo entra si tiene fecha
        de vencimiento y todavía debe dinero.
      </p>

      {(sinConectar.length > 0 || sinVencimiento > 0) && (
        <div
          style={{
            display: "flex", gap: "0.6rem", alignItems: "flex-start",
            backgroundColor: "#f59e0b14", border: "1px solid #f59e0b55",
            borderRadius: "0.75rem", padding: "0.85rem 1rem", margin: "1.25rem 0",
            maxWidth: "44rem",
          }}
        >
          <AlertTriangle style={{ width: "1rem", height: "1rem", color: "#f59e0b", flexShrink: 0, marginTop: "0.15rem" }} />
          <div style={{ fontSize: "0.8125rem", color: "var(--app-nav-text)", lineHeight: 1.55 }}>
            {sinConectar.length > 0 && (
              <p style={{ margin: 0 }}>
                {sinConectar.map((c) => CHANNEL_LABELS[c]).join(" y ")}{" "}
                {sinConectar.length === 1 ? "no está conectado" : "no están conectados"}: falta la cuenta
                del proveedor. Se puede marcar en una regla, pero no saldrá nada por ahí —quedará
                anotado abajo para que se note.
              </p>
            )}
            {sinVencimiento > 0 && (
              <p style={{ margin: sinConectar.length > 0 ? "0.5rem 0 0" : 0 }}>
                Hay {sinVencimiento} factura{sinVencimiento === 1 ? "" : "s"} emitida
                {sinVencimiento === 1 ? "" : "s"} sin fecha de vencimiento. Ninguna regla las alcanza
                hasta que alguien se la ponga.
              </p>
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: "44rem", marginTop: "1.5rem" }}>
        <ReminderRules reglas={paraElCliente} canalesListos={canalesListos} />
      </div>

      {ultimos.length > 0 && (
        <div style={{ maxWidth: "44rem", marginTop: "2.5rem" }}>
          <h2 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
            Lo último que salió
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {ultimos.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex", alignItems: "baseline", gap: "0.6rem", flexWrap: "wrap",
                  padding: "0.55rem 0.75rem", borderRadius: "0.5rem",
                  border: "1px solid var(--app-border)", fontSize: "0.8125rem",
                }}
              >
                <span
                  style={{
                    fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.03em",
                    color: r.status === "SENT" ? "#22c55e" : r.status === "FAILED" ? "#dc2626" : "#f59e0b",
                  }}
                >
                  {r.status === "SENT" ? "ENVIADO" : r.status === "FAILED" ? "FALLÓ" : "SIN SALIR"}
                </span>
                <Link
                  href={`/facturacion/${r.billingItem.id}`}
                  style={{ color: "#fd1384", textDecoration: "none", fontWeight: 500 }}
                >
                  {r.billingItem.concept}
                </Link>
                <span style={{ color: "var(--app-text-muted)" }}>
                  {r.billingItem.company.name} · {CHANNEL_LABELS[r.channel]} ·{" "}
                  {r.recipientName ?? r.recipient} · {formatDateTimeLong(r.sentAt)}
                </span>
                {r.error && (
                  <span style={{ width: "100%", color: "#b45309", fontSize: "0.75rem" }}>{r.error}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
