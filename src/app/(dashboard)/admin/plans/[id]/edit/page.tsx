import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { PlanEditForm } from "@/components/admin/plan-edit-form";
import { notFound } from "next/navigation";

export const metadata = { title: "Editar plan — Geniorama Tickets" };

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMINISTRADOR"]);

  const { id } = await params;

  const [plan, companies] = await Promise.all([
    prisma.plan.findUnique({ where: { id } }),
    prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!plan) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar plan</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <PlanEditForm plan={plan} companies={companies} />
      </div>
    </div>
  );
}
