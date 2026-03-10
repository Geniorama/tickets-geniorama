import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ServiceForm } from "@/components/services/service-form";

export const metadata = { title: "Nuevo servicio — Geniorama Tickets" };

export default async function NewServicioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireRole(["ADMINISTRADOR"]);
  const params = await searchParams;

  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div style={{ padding: "1.5rem", maxWidth: "720px" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "1.5rem" }}>
        Nuevo servicio
      </h1>
      <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1.5rem" }}>
        <ServiceForm companies={companies} defaultCompanyId={params.companyId} />
      </div>
    </div>
  );
}
