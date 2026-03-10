import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { CompanyEditForm } from "@/components/admin/company-edit-form";

export const metadata = { title: "Editar empresa — Geniorama Tickets" };

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMINISTRADOR"]);
  const { id } = await params;

  const [company, agencies] = await Promise.all([
    prisma.company.findUnique({ where: { id } }),
    prisma.company.findMany({
      where: { type: "AGENCIA", isActive: true, NOT: { id } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!company) notFound();

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar empresa</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <CompanyEditForm company={company} agencies={agencies} />
      </div>
    </div>
  );
}
