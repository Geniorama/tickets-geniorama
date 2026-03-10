import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { PlanForm } from "@/components/admin/plan-form";

export const metadata = { title: "Nuevo plan — Geniorama Tickets" };

export default async function NewPlanPage() {
  await requireRole(["ADMINISTRADOR"]);

  const companies = await prisma.company.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo plan</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <PlanForm companies={companies} />
      </div>
    </div>
  );
}
