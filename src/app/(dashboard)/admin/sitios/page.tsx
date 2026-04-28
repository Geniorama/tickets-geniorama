import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Globe } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { Suspense } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { SitesTable } from "@/components/admin/sites-table";
import { getPageSize } from "@/lib/pagination";

export const metadata = { title: "Sitios y apps — Geniorama Tickets" };

export default async function SitiosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireRole(["ADMINISTRADOR", "COLABORADOR"]);
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = getPageSize(params.pageSize);
  const sortBy  = params.sortBy  ?? "name";
  const sortDir = (params.sortDir === "asc" ? "asc" : "desc") as "asc" | "desc";
  const q = params.q?.trim() || undefined;
  const siteWhere = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { domain: { contains: q, mode: "insensitive" as const } }] }
    : {};

  const sitesOrderBy: Record<string, unknown> = (() => {
    const d = sortDir;
    switch (sortBy) {
      case "domain":   return { domain: d };
      case "company":  return { company: { name: d } };
      case "isActive": return { isActive: d };
      default:         return { name: d };
    }
  })();

  const baseParams = new URLSearchParams(params as Record<string, string>);
  baseParams.delete("sortBy");
  baseParams.delete("sortDir");
  baseParams.delete("page");
  const paramsStr = baseParams.toString();

  const [sites, totalSites] = await Promise.all([
    prisma.site.findMany({
      where: siteWhere,
      include: { company: { select: { name: true } } },
      orderBy: sitesOrderBy,
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.site.count({ where: siteWhere }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sitios y apps</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona los sitios y aplicaciones vinculados a cada empresa. Los tickets pueden referenciarse a uno de estos sitios.
          </p>
        </div>
        <Link
          href="/admin/sitios/new"
          className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo sitio
        </Link>
      </div>

      <div>
        <Suspense fallback={<div style={{ height: "2.375rem" }} />}>
          <SearchInput placeholder="Buscar por nombre o dominio..." />
        </Suspense>
      </div>

      {totalSites === 0 && !q ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Globe className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No hay sitios creados aún</p>
          <p className="text-sm text-gray-400 mt-1">
            Crea el primer sitio para que los clientes puedan vincularlo a sus tickets.
          </p>
          <Link
            href="/admin/sitios/new"
            className="inline-flex items-center gap-1.5 mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear sitio
          </Link>
        </div>
      ) : (
        <SitesTable sites={sites} sortBy={sortBy} sortDir={sortDir} paramsStr={paramsStr} />
      )}

      <Pagination
        totalItems={totalSites}
        currentPage={page}
        pageSize={pageSize}
        params={params}
        basePath="/admin/sitios"
      />
    </div>
  );
}
