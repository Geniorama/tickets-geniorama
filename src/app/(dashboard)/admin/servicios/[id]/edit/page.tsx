import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ServiceForm } from "@/components/services/service-form";
import { DeleteServiceButton } from "@/components/services/delete-service-button";

export const metadata = { title: "Editar servicio — Geniorama Tickets" };

export default async function EditServicioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMINISTRADOR"]);
  const { id } = await params;

  const [service, companies] = await Promise.all([
    prisma.service.findUnique({
      where: { id },
      include: { company: { select: { id: true, name: true } } },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!service) notFound();

  return (
    <div style={{ padding: "1.5rem", maxWidth: "720px" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "1.5rem" }}>
        Editar servicio
      </h1>
      <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "1.5rem" }}>
        <ServiceForm companies={companies} service={service} />
      </div>

      <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
        <DeleteServiceButton serviceId={id} />
      </div>
    </div>
  );
}
