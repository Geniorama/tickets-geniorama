import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { SiteForm } from "@/components/sites/site-form";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Nuevo sitio — Geniorama Tickets" };

export default async function NewSitioPage() {
  await requireRole(["ADMINISTRADOR", "COLABORADOR"]);

  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <BackButton />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo sitio / app</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <SiteForm companies={companies} />
      </div>
    </div>
  );
}
