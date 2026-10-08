import { requireCan } from "@/lib/access/can";
import { operationalCompanyWhere } from "@/lib/crm/accounts";
import { prisma } from "@/lib/prisma";
import { UserForm } from "@/components/admin/user-form";
import { listAccessProfiles } from "@/lib/access/profiles";

export const metadata = { title: "Nuevo usuario" };

export default async function NewUserPage() {
  await requireCan("ADMIN");

  const [companies, profiles] = await Promise.all([
    prisma.company.findMany({
      where: operationalCompanyWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    listAccessProfiles(),
  ]);

  // El perfil «Cliente» es el único que concede el Portal: no es para el equipo.
  const staffProfiles = profiles
    .filter((p) => !(p.grants && typeof p.grants === "object" && "PORTAL" in p.grants))
    .map((p) => ({ id: p.id, name: p.name, description: p.description }));

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nuevo usuario</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <UserForm companies={companies} profiles={staffProfiles} />
      </div>
    </div>
  );
}
