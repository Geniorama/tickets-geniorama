import { notFound } from "next/navigation";
import { requireCan, can } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import {
  BILLING_STATUS_COLORS, BILLING_STATUS_LABELS, pendiente,
} from "@/lib/billing/status";
import { formatAmount } from "@/lib/money";
import { getBillingFormData } from "@/lib/billing/form-data";
import { BillingForm } from "@/components/billing/billing-form";
import { BackButton } from "@/components/ui/back-button";
import { formatDate } from "@/lib/format-date";
import { describirImpuesto } from "@/lib/billing/totals";
import { listComments } from "@/lib/comments";
import { listAttachments } from "@/lib/attachments";
import { isAdmin } from "@/lib/roles";
import { BillingNotes } from "@/components/billing/billing-notes";
import { LabelPicker } from "@/components/billing/label-picker";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cobro = await prisma.billingItem.findUnique({ where: { id }, select: { concept: true } });
  return { title: cobro?.concept ?? "Cobro" };
}

/** El `<input type="date">` quiere yyyy-MM-dd, no un ISO completo. */
function asDateInput(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

export default async function BillingItemPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCan("FACTURACION", "ver");
  const { id } = await params;
  const canEdit = await can(session.user, "FACTURACION", "editar");

  const cobro = await prisma.billingItem.findUnique({
    where: { id },
    select: {
      id: true, concept: true, status: true, amount: true, subtotal: true,
      taxAmount: true, paidAmount: true,
      dueDate: true, invoiceNumber: true, invoicedAt: true, paidAt: true, notes: true,
      lines: {
        orderBy: { position: "asc" },
        select: { id: true, concept: true, amount: true, taxRate: true },
      },
      companyId: true, ownerId: true,
      labels: { select: { id: true, name: true, color: true } },
      company: { select: { id: true, name: true } },
      owner: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  if (!cobro) notFound();

  const canManage = await can(session.user, "FACTURACION", "gestionar");

  // Comentarios y adjuntos viven en las tablas compartidas del núcleo.
  const [{ companies, owners }, comments, attachments, etiquetas] = await Promise.all([
    canEdit ? getBillingFormData() : Promise.resolve({ companies: [], owners: [] }),
    listComments({ entityType: "BILLING", entityId: id, includeInternal: true }),
    listAttachments("BILLING", id),
    prisma.billingLabel.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true, color: true } }),
  ]);
  const color = BILLING_STATUS_COLORS[cobro.status];
  const falta = pendiente(cobro.amount, cobro.paidAmount);

  return (
    <div>
      <div className="mb-4">
        <BackButton fallback="/facturacion" />
      </div>

      <div className="mb-5">
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            {cobro.concept}
          </h1>
          <span
            style={{
              fontSize: "0.6875rem", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.04em", padding: "0.2rem 0.6rem", borderRadius: "9999px",
              backgroundColor: `${color}22`, color,
            }}
          >
            {BILLING_STATUS_LABELS[cobro.status]}
          </span>
          {cobro.labels.map((l) => (
            <span
              key={l.id}
              style={{
                fontSize: "0.6875rem", fontWeight: 600, padding: "0.2rem 0.55rem",
                borderRadius: "9999px", backgroundColor: `${l.color}22`, color: l.color,
              }}
            >
              {l.name}
            </span>
          ))}
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.3rem" }}>
          {[
            cobro.company.name,
            cobro.invoiceNumber ? `Factura ${cobro.invoiceNumber}` : null,
            cobro.owner ? `Responsable: ${cobro.owner.name}` : null,
            cobro.dueDate ? `Fecha: ${formatDate(cobro.dueDate)}` : null,
          ].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ alignItems: "start" }}>
        {/* El dinero primero: es a lo que se viene. */}
        <div
          style={{
            backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
            borderRadius: "0.75rem", padding: "1.25rem",
          }}
        >
          <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "1rem" }}>
            El dinero
          </p>

          {/* El desglose por concepto: es lo que se compara contra la factura
              de verdad cuando algo no cuadra. */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", marginBottom: "0.85rem" }}>
            {cobro.lines.map((l) => (
              <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--app-nav-text)", minWidth: 0 }}>
                  {l.concept}
                  <span style={{ color: "var(--app-text-muted)" }}> · {describirImpuesto(l.taxRate)}</span>
                </span>
                <span style={{ fontSize: "0.875rem", color: "var(--app-body-text)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {formatAmount(l.amount)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", paddingTop: "0.75rem", borderTop: "1px solid var(--app-border)" }}>
            <Fila etiqueta="Subtotal" valor={formatAmount(cobro.subtotal)} />
            <Fila etiqueta="IVA" valor={formatAmount(cobro.taxAmount)} />
            <Fila etiqueta="Total" valor={formatAmount(cobro.amount)} />
            {cobro.paidAmount > 0 && (
              <Fila etiqueta="Abonado" valor={formatAmount(cobro.paidAmount)} color="#f59e0b" />
            )}
            <Fila
              etiqueta={falta === 0 ? "Cobrado" : "Falta por cobrar"}
              valor={falta === 0 ? formatAmount(cobro.amount) : formatAmount(falta)}
              color={falta === 0 ? "#16a34a" : "#dc2626"}
              destacada
            />
          </div>

          <div style={{ marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--app-border)", display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <Sello etiqueta="Facturado el" fecha={cobro.invoicedAt} />
            <Sello etiqueta="Pagado el" fecha={cobro.paidAt} />
            <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
              Creado por {cobro.createdBy.name}
            </p>
          </div>

          {cobro.notes && (
            <p style={{ fontSize: "0.8125rem", color: "var(--app-nav-text)", whiteSpace: "pre-wrap", marginTop: "1rem", paddingTop: "0.85rem", borderTop: "1px solid var(--app-border)" }}>
              {cobro.notes}
            </p>
          )}
        </div>

        <BillingNotes
          billingItemId={cobro.id}
          comments={comments.map((c) => ({
            id: c.id,
            body: c.body,
            createdAt: c.createdAt,
            author: { id: c.author.id, name: c.author.name },
          }))}
          attachments={attachments.map((a) => ({
            id: a.id,
            fileName: a.fileName,
            fileUrl: a.fileUrl,
            createdAt: a.createdAt,
            uploadedBy: a.uploadedBy ? { name: a.uploadedBy.name } : null,
          }))}
          canEdit={canEdit}
          currentUserId={session.user.id}
          isAdmin={isAdmin(session.user.role)}
        />

        {canEdit && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div
              style={{
                backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
                borderRadius: "0.75rem", padding: "1.25rem",
              }}
            >
              <LabelPicker
                billingItemId={cobro.id}
                todas={etiquetas}
                puestas={cobro.labels.map((l) => l.id)}
                canEdit={canEdit}
                canCreate={canManage}
              />
            </div>

            <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.6rem" }}>
              Datos del cobro
            </h2>
            <BillingForm
              companies={companies}
              owners={owners}
              fixedCompanyId={cobro.companyId}
              initial={{
                id: cobro.id,
                concept: cobro.concept,
                status: cobro.status,
                lines: cobro.lines.map((l) => ({ concept: l.concept, amount: l.amount, taxRate: l.taxRate })),
                dueDate: asDateInput(cobro.dueDate),
                invoiceNumber: cobro.invoiceNumber,
                ownerId: cobro.ownerId,
                notes: cobro.notes,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Fila({
  etiqueta, valor, color, destacada,
}: {
  etiqueta: string; valor: string | null; color?: string; destacada?: boolean;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
      <span style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>{etiqueta}</span>
      <span
        style={{
          fontSize: destacada ? "1.125rem" : "0.9375rem",
          fontWeight: destacada ? 700 : 600,
          color: color ?? "var(--app-body-text)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {valor}
      </span>
    </div>
  );
}

function Sello({ etiqueta, fecha }: { etiqueta: string; fecha: Date | null }) {
  if (!fecha) return null;
  return (
    <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
      {etiqueta} {formatDate(fecha)}
    </p>
  );
}
