import { requireCan } from "@/lib/access/can";
import { getBillingFormData } from "@/lib/billing/form-data";
import { BillingForm } from "@/components/billing/billing-form";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Nuevo cobro" };

export default async function NewBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string }>;
}) {
  await requireCan("FACTURACION", "crear");
  const { empresa } = await searchParams;
  const { companies, owners } = await getBillingFormData();

  const fija = empresa && companies.some((c) => c.id === empresa) ? empresa : undefined;

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <BackButton fallback="/facturacion" />
      </div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "0.25rem" }}>
        Nuevo cobro
      </h1>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1.25rem" }}>
        Algo que hay que facturarle a una empresa. Nace en Backlog salvo que ya toque.
      </p>

      {companies.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
          Primero hay que registrar una empresa.
        </p>
      ) : (
        <BillingForm companies={companies} owners={owners} fixedCompanyId={fija} />
      )}
    </div>
  );
}
