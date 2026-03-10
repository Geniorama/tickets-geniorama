import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { UserForm } from "@/components/admin/user-form";

export const metadata = { title: "Nuevo usuario — Geniorama Tickets" };

export default async function NewUserPage() {
  await requireRole(["ADMINISTRADOR"]);

  const companies = await prisma.company.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo usuario</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <UserForm companies={companies} />
      </div>
    </div>
  );
}
