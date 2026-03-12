import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { formatDate } from "@/lib/format-date";
import { ResendInvitationButton } from "@/components/admin/resend-invitation-button";
import { ToggleUserActiveButton } from "@/components/admin/toggle-user-active-button";
import { DeleteUserButton } from "@/components/admin/delete-user-button";
import { Plus, Pencil } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";

export const metadata = { title: "Usuarios — Geniorama Tickets" };

const PAGE_SIZE = 25;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await requireRole(["ADMINISTRADOR"]);
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [users, totalUsers] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        companies: { select: { name: true } },
        createdAt: true,
      },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.user.count(),
  ]);

  const roleLabels = {
    ADMINISTRADOR: "Administrador",
    COLABORADOR: "Colaborador",
    CLIENTE: "Cliente",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <Link
          href="/admin/users/new"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo usuario
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Empresa</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Rol</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Estado</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Creado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => (
              <tr key={user.id} className={`hover:bg-gray-50 ${!user.isActive ? "opacity-60" : ""}`}>
                <td className="px-4 py-3 font-medium text-gray-900">
                  <Link href={`/admin/users/${user.id}`} className="hover:text-indigo-600">
                    {user.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{user.email}</td>
                <td className="px-4 py-3 text-gray-500 text-sm">
                  {user.companies.length > 0
                    ? user.companies.map((c) => c.name).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium">
                    {roleLabels[user.role]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      user.isActive
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {user.isActive ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {formatDate(user.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ToggleUserActiveButton
                      userId={user.id}
                      isActive={user.isActive}
                      isSelf={user.id === session.user.id}
                    />
                    <ResendInvitationButton userId={user.id} />
                    <Link
                      href={`/admin/users/${user.id}/edit`}
                      className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </Link>
                    <DeleteUserButton
                      userId={user.id}
                      userName={user.name}
                      isSelf={user.id === session.user.id}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        totalItems={totalUsers}
        currentPage={page}
        pageSize={PAGE_SIZE}
        params={params}
        basePath="/admin/users"
      />
    </div>
  );
}
