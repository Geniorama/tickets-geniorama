import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { SiteForm } from "@/components/sites/site-form";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Editar sitio — Geniorama Tickets" };

export default async function EditSitioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMINISTRADOR", "COLABORADOR"]);
  const { id } = await params;

  const [site, companies] = await Promise.all([
    prisma.site.findUnique({ where: { id } }),
    prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!site) notFound();

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <BackButton />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar sitio</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <SiteForm companies={companies} site={site} />
      </div>
    </div>
  );
}
