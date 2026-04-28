import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CompanyTable } from "@/components/admin/company-table";
import { CompanyFilters } from "@/components/admin/company-filters";
import { Pagination } from "@/components/ui/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Suspense } from "react";
import { getPageSize } from "@/lib/pagination";

export const metadata = { title: "Empresas — Geniorama Tickets" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireRole(["ADMINISTRADOR"]);
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = getPageSize(params.pageSize);
  const sortBy  = params.sortBy  ?? "name";
  const sortDir = (params.sortDir === "desc" ? "desc" : "asc") as "asc" | "desc";

  const q = params.q?.trim() || undefined;
  const typeFilter = params.type === "AGENCIA" || params.type === "EMPRESA" ? params.type : undefined;
  const isActiveFilter = params.isActive === "true" ? true : params.isActive === "false" ? false : undefined;
  const parentFilter = params.parentId || undefined;

  const where = {
    ...(q
      ? {
          OR: [
            { name:  { contains: q, mode: "insensitive" as const } },
            { taxId: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(typeFilter     ? { type: typeFilter as never }   : {}),
    ...(isActiveFilter !== undefined ? { isActive: isActiveFilter } : {}),
    ...(parentFilter   ? { parentId: parentFilter }      : {}),
  };

  const orderBy: Record<string, unknown> = (() => {
    const d = sortDir;
    switch (sortBy) {
      case "type":     return { type: d };
      case "parent":   return { parent: { name: d } };
      case "users":    return { users: { _count: d } };
      case "isActive": return { isActive: d };
      default:         return { name: d };
    }
  })();

  const baseParams = new URLSearchParams(params as Record<string, string>);
  baseParams.delete("sortBy");
  baseParams.delete("sortDir");
  baseParams.delete("page");
  const paramsStr = baseParams.toString();

  const [companies, totalCompanies, agencies] = await Promise.all([
    prisma.company.findMany({
      where,
      orderBy,
      include: {
        parent:  { select: { name: true } },
        _count:  { select: { users: true } },
      },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.company.count({ where }),
    prisma.company.findMany({
      where: { type: "AGENCIA" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows = companies.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    taxId: c.taxId,
    logoUrl: c.logoUrl,
    isActive: c.isActive,
    parentName: c.parent?.name,
    userCount: c._count.users,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
        <Link
          href="/admin/companies/new"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva empresa
        </Link>
      </div>

      <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <Suspense fallback={<div style={{ height: "2.375rem", width: "220px" }} />}>
          <SearchInput placeholder="Buscar por nombre o NIT..." />
        </Suspense>
        <Suspense fallback={null}>
          <CompanyFilters agencies={agencies} />
        </Suspense>
      </div>

      <CompanyTable rows={rows} sortBy={sortBy} sortDir={sortDir} paramsStr={paramsStr} />

      <Pagination
        totalItems={totalCompanies}
        currentPage={page}
        pageSize={pageSize}
        params={params}
        basePath="/admin/companies"
      />
    </div>
  );
}
