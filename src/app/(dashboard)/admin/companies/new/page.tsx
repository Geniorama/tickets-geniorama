import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { CompanyForm } from "@/components/admin/company-form";

export const metadata = { title: "Nueva empresa — Geniorama Tickets" };

export default async function NewCompanyPage() {
  await requireRole(["ADMINISTRADOR"]);

  const agencies = await prisma.company.findMany({
    where: { type: "AGENCIA", isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nueva empresa</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <CompanyForm agencies={agencies} />
      </div>
    </div>
  );
}
