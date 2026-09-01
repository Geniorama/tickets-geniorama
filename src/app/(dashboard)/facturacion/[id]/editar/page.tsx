import { notFound } from "next/navigation";
import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { getBillingFormData } from "@/lib/billing/form-data";
import { BillingForm } from "@/components/billing/billing-form";
import { BackButton } from "@/components/ui/back-button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cobro = await prisma.billingItem.findUnique({ where: { id }, select: { concept: true } });
  return { title: cobro ? `Editar: ${cobro.concept}` : "Editar cobro" };
}

/** El `<input type="date">` quiere yyyy-MM-dd, no un ISO completo. */
function asDateInput(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/**
 * Editar un cobro, en su propia pantalla.
 *
 * Antes el formulario vivía siempre abierto debajo del detalle, repitiendo el
 * importe, el estado, las fechas y las notas que ya estaban arriba. Dos sitios
 * diciendo lo mismo en la misma pantalla, y media página de campos para quien
 * solo venía a mirar cuánto falta por cobrar.
 *
 * Aparte es además la convención del resto de la aplicación: los tickets y las
 * tareas se editan en `/…/edit`.
 */
export default async function EditarCobroPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCan("FACTURACION", "editar");
  const { id } = await params;

  const cobro = await prisma.billingItem.findUnique({
    where: { id },
    select: {
      id: true, concept: true, status: true, companyId: true, ownerId: true, notes: true,
      dueDate: true, invoiceDueDate: true, invoiceNumber: true,
      lines: {
        orderBy: { position: "asc" },
        select: {
          concept: true, amount: true, taxRate: true, categoryId: true,
          category: { select: { name: true } },
        },
      },
    },
  });
  if (!cobro) notFound();

  const { companies, owners, categories } = await getBillingFormData();

  return (
    <div>
      <div className="mb-4">
        <BackButton fallback={`/facturacion/${id}`} />
      </div>

      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "1.25rem" }}>
        Editar cobro
      </h1>

      <div style={{ maxWidth: "44rem" }}>
        <BillingForm
          companies={companies}
          owners={owners}
          categorias={categories}
          fixedCompanyId={cobro.companyId}
          initial={{
            id: cobro.id,
            concept: cobro.concept,
            status: cobro.status,
            lines: cobro.lines.map((l) => ({
              concept: l.concept, amount: l.amount, taxRate: l.taxRate,
              categoryId: l.categoryId, categoryName: l.category?.name ?? null,
            })),
            dueDate: asDateInput(cobro.dueDate),
            invoiceDueDate: asDateInput(cobro.invoiceDueDate),
            invoiceNumber: cobro.invoiceNumber,
            ownerId: cobro.ownerId,
            notes: cobro.notes,
          }}
        />
      </div>
    </div>
  );
}
