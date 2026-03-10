import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { UserEditForm } from "@/components/admin/user-edit-form";

export const metadata = { title: "Editar usuario — Geniorama Tickets" };

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMINISTRADOR"]);
  const { id } = await params;

  const [userRaw, companies] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, role: true, isActive: true,
        companies: { select: { id: true } },
      },
    }),
    prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!userRaw) notFound();

  const user = {
    ...userRaw,
    companyIds: userRaw.companies.map((c) => c.id),
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Editar usuario</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <UserEditForm user={user} companies={companies} />
      </div>
    </div>
  );
}
