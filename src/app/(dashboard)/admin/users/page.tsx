import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { Suspense } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { UsersTable } from "@/components/admin/users-table";
import { UserFilters } from "@/components/admin/user-filters";
import { getPageSize } from "@/lib/pagination";

export const metadata = { title: "Usuarios — Geniorama Tickets" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await requireRole(["ADMINISTRADOR"]);
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = getPageSize(params.pageSize);
  const sortBy  = params.sortBy  ?? "createdAt";
  const sortDir = (params.sortDir === "asc" ? "asc" : "desc") as "asc" | "desc";
  const q         = params.q?.trim() || undefined;
  const roleFilter     = params.role     || undefined;
  const isActiveFilter = params.isActive !== undefined && params.isActive !== ""
    ? params.isActive === "true"
    : undefined;
  const companyFilter  = params.companyId || undefined;

  const userWhere = {
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {}),
    ...(roleFilter     ? { role: roleFilter as never }            : {}),
    ...(isActiveFilter !== undefined ? { isActive: isActiveFilter } : {}),
    ...(companyFilter  ? { companies: { some: { id: companyFilter } } } : {}),
  };

  const usersOrderBy: Record<string, unknown> = (() => {
    const d = sortDir;
    switch (sortBy) {
      case "name":      return { name: d };
      case "email":     return { email: d };
      case "role":      return { role: d };
      case "isActive":  return { isActive: d };
      default:          return { createdAt: d };
    }
  })();

  const baseParams = new URLSearchParams(params as Record<string, string>);
  baseParams.delete("sortBy");
  baseParams.delete("sortDir");
  baseParams.delete("page");
  const paramsStr = baseParams.toString();

  const [users, totalUsers, companies] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      orderBy: usersOrderBy,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        companies: { select: { name: true } },
        createdAt: true,
      },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.user.count({ where: userWhere }),
    prisma.company.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

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

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <Suspense fallback={<div style={{ height: "2.375rem", width: "220px" }} />}>
          <SearchInput placeholder="Buscar por nombre o email..." />
        </Suspense>
        <Suspense fallback={null}>
          <UserFilters companies={companies} />
        </Suspense>
      </div>

      <UsersTable
        users={users}
        currentUserId={session.user.id}
        sortBy={sortBy}
        sortDir={sortDir}
        paramsStr={paramsStr}
      />

      <Pagination
        totalItems={totalUsers}
        currentPage={page}
        pageSize={pageSize}
        params={params}
        basePath="/admin/users"
      />
    </div>
  );
}
