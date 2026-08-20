import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { AccountForm } from "@/components/crm/account-form";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Nueva cuenta" };

export default async function NewAccountPage() {
  await requireCan("CRM", "crear");

  // Solo el equipo puede llevar una cuenta.
  const owners = await prisma.user.findMany({
    where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-xl">
      <div className="mb-4">
        <BackButton fallback="/crm" />
      </div>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "0.25rem" }}>
        Nueva cuenta
      </h1>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1.25rem" }}>
        Registra un lead o prospecto. Cuando se gane, pasa a cliente sin perder nada de lo registrado.
      </p>
      <AccountForm owners={owners} />
    </div>
  );
}
