import { requireCan } from "@/lib/access/can";
import { getDealFormData } from "@/lib/crm/form-data";
import { DealForm } from "@/components/crm/deal-form";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Nueva oportunidad" };

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string }>;
}) {
  await requireCan("CRM", "crear");
  const { cuenta } = await searchParams;
  const { accounts, owners } = await getDealFormData();

  // Si se llega desde la ficha de una cuenta, viene ya elegida.
  const fija = cuenta && accounts.some((a) => a.id === cuenta) ? cuenta : undefined;

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <BackButton fallback="/crm/oportunidades" />
      </div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "0.25rem" }}>
        Nueva oportunidad
      </h1>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1.25rem" }}>
        Una venta concreta sobre una cuenta. Una misma empresa puede tener varias abiertas.
      </p>

      {accounts.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
          Primero hay que registrar una cuenta.
        </p>
      ) : (
        <DealForm accounts={accounts} owners={owners} fixedAccountId={fija} />
      )}
    </div>
  );
}
