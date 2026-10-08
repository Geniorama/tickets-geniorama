import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { canalDisponible, loQueFalta } from "@/lib/billing/reminders/channels";
import { EmailTemplates, type Plantilla } from "@/components/billing/email-templates";
import { EmailLog, type CorreoRegistrado } from "@/components/billing/email-log";

export const metadata = { title: "Correos a clientes" };

const titulo: React.CSSProperties = {
  fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)",
  textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem",
};

const CORREO = {
  id: true, status: true, subject: true, templateName: true, recipients: true,
  scheduledFor: true, sentAt: true, createdAt: true, error: true,
  createdBy: { select: { name: true } },
  billingItem: { select: { id: true, concept: true, company: { select: { name: true } } } },
};

export default async function CorreosPage() {
  // Basta con entrar a Facturación. Las reglas de recordatorio piden gestor
  // porque escriben solas; aquí cada correo lo manda alguien que lo ve antes.
  await requireCan("FACTURACION", "ver");

  const [plantillas, programados, ultimos] = await Promise.all([
    prisma.billingEmailTemplate.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { emails: { where: { status: "ENVIADO" } } } } },
    }),
    prisma.billingEmail.findMany({
      where: { status: { in: ["PROGRAMADO", "ENVIANDO"] } },
      orderBy: { scheduledFor: "asc" },
      take: 50,
      select: CORREO,
    }),
    prisma.billingEmail.findMany({
      where: { status: { notIn: ["PROGRAMADO", "ENVIANDO"] } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: CORREO,
    }),
  ]);

  const paraElCliente: Plantilla[] = plantillas.map((p) => ({
    id: p.id,
    name: p.name,
    subject: p.subject,
    body: p.body,
    onlyIfPending: p.onlyIfPending,
    enviados: p._count.emails,
  }));

  const registrar = (c: (typeof ultimos)[number]): CorreoRegistrado => ({
    id: c.id,
    status: c.status,
    subject: c.subject,
    templateName: c.templateName,
    recipients: c.recipients,
    scheduledFor: c.scheduledFor,
    sentAt: c.sentAt,
    createdAt: c.createdAt,
    error: c.error,
    createdBy: c.createdBy.name,
    cobro: { id: c.billingItem.id, concept: c.billingItem.concept, empresa: c.billingItem.company.name },
  });

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
        Correos a clientes
      </h1>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.25rem", maxWidth: "44rem" }}>
        Plantillas para escribirle a un cliente sobre un cobro: un pago recibido,
        una cobranza. Se mandan desde la ficha de cada cobro, en el momento o
        programadas para un día y una hora.
      </p>

      {!canalDisponible("EMAIL") && (
        <div
          style={{
            display: "flex", gap: "0.6rem", alignItems: "flex-start",
            backgroundColor: "#f59e0b14", border: "1px solid #f59e0b55",
            borderRadius: "0.75rem", padding: "0.85rem 1rem", margin: "1.25rem 0",
            maxWidth: "44rem",
          }}
        >
          <AlertTriangle style={{ width: "1rem", height: "1rem", color: "#f59e0b", flexShrink: 0, marginTop: "0.15rem" }} />
          <p style={{ fontSize: "0.8125rem", color: "var(--app-nav-text)", lineHeight: 1.55, margin: 0 }}>
            El servidor no puede mandar correo: falta configurar {loQueFalta("EMAIL").join(", ")}.
            Se pueden preparar las plantillas, pero no saldrá nada.
          </p>
        </div>
      )}

      <div style={{ maxWidth: "44rem", marginTop: "1.5rem" }}>
        <EmailTemplates plantillas={paraElCliente} />
      </div>

      {programados.length > 0 && (
        <div style={{ maxWidth: "44rem", marginTop: "2.5rem" }}>
          <h2 style={titulo}>Programados</h2>
          <EmailLog correos={programados.map(registrar)} />
        </div>
      )}

      {ultimos.length > 0 && (
        <div style={{ maxWidth: "44rem", marginTop: "2.5rem" }}>
          <h2 style={titulo}>Lo último que salió</h2>
          <EmailLog correos={ultimos.map(registrar)} />
        </div>
      )}
    </div>
  );
}
