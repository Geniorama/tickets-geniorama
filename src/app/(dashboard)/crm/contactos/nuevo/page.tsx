import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { StandaloneContactForm } from "@/components/crm/standalone-contact-form";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Nuevo contacto" };

export default async function NewContactPage({
  searchParams,
}: {
  searchParams: Promise<{ cuenta?: string }>;
}) {
  await requireCan("CRM", "crear");
  const { cuenta } = await searchParams;

  // Todas las cuentas, no solo las CLIENTE: un lead tiene contactos desde el
  // primer día, que es justo cuando más falta hacen.
  const accounts = await prisma.company.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const elegida = cuenta && accounts.some((a) => a.id === cuenta) ? cuenta : undefined;

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <BackButton fallback="/crm/contactos" />
      </div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "0.25rem" }}>
        Nuevo contacto
      </h1>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1.25rem" }}>
        Una persona dentro de una cuenta. No accede a nada todavía: eso se decide después.
      </p>

      {accounts.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
          Primero hay que registrar una cuenta.
        </p>
      ) : (
        <StandaloneContactForm accounts={accounts} defaultAccountId={elegida} />
      )}
    </div>
  );
}
