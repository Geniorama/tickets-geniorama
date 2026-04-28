import { getRequiredSession } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { VaultList } from "@/components/vault/vault-list";
import { VaultFilters } from "@/components/vault/vault-filters";
import { Pagination } from "@/components/ui/pagination";
import { getPageSize } from "@/lib/pagination";
import { SearchInput } from "@/components/ui/search-input";
import { Suspense } from "react";

export const metadata = { title: "Bóveda — Geniorama Tickets" };

export default async function BovedaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const session = await getRequiredSession();
  const admin = isAdmin(session.user.role);
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const pageSize = getPageSize(params.pageSize);
  const q = params.q?.trim() || undefined;

  const companyFilter = params.companyId || undefined;
  const serviceFilter = params.serviceId || undefined;
  const createdByFilter = params.createdById || undefined;
  const access = params.access === "owned" || params.access === "shared" ? params.access : undefined;

  // Filtro de acceso base
  let accessFilter: object;
  if (admin) {
    accessFilter = {};
  } else if (access === "owned") {
    accessFilter = { createdById: session.user.id };
  } else if (access === "shared") {
    accessFilter = { sharedWith: { some: { userId: session.user.id } } };
  } else {
    accessFilter = {
      OR: [
        { createdById: session.user.id },
        { sharedWith: { some: { userId: session.user.id } } },
      ],
    };
  }

  const searchFilter = q
    ? {
        OR: [
          { title:    { contains: q, mode: "insensitive" as const } },
          { username: { contains: q, mode: "insensitive" as const } },
          { url:      { contains: q, mode: "insensitive" as const } },
          { company:   { name: { contains: q, mode: "insensitive" as const } } },
          { site:      { name: { contains: q, mode: "insensitive" as const } } },
          { service:   { name: { contains: q, mode: "insensitive" as const } } },
          { createdBy: { name: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const where = {
    AND: [
      accessFilter,
      searchFilter,
      ...(companyFilter   ? [{ companyId:   companyFilter }]   : []),
      ...(serviceFilter   ? [{ serviceId:   serviceFilter }]   : []),
      ...(createdByFilter ? [{ createdById: createdByFilter }] : []),
    ],
  };

  // Las opciones de filtros se acotan al universo accesible para el usuario
  // (sin aplicar los demás filtros, para que pueda elegir libremente).
  const filterScope = { AND: [accessFilter] };

  const [entries, totalEntries, companies, services, creators] = await Promise.all([
    prisma.vaultEntry.findMany({
      where,
      include: {
        company:    { select: { name: true } },
        site:       { select: { name: true } },
        service:    { select: { name: true } },
        createdBy:  { select: { name: true } },
        sharedWith: { select: { userId: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
    prisma.vaultEntry.count({ where }),
    prisma.company.findMany({
      where: { vaultEntries: { some: filterScope } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({
      where: { vaultEntries: { some: filterScope } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { createdVaultEntries: { some: filterScope } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--app-body-text)" }}>Bóveda</h1>
          <p className="text-sm mt-1" style={{ color: "var(--app-text-muted)" }}>
            Credenciales seguras vinculadas a tus clientes y plataformas.
          </p>
        </div>
        <Link
          href="/boveda/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: "#fd1384", color: "#ffffff" }}
        >
          <Plus className="w-4 h-4" />
          Nueva entrada
        </Link>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <Suspense fallback={<div style={{ height: "2.375rem", width: "220px" }} />}>
          <SearchInput placeholder="Buscar por título, usuario, empresa, sitio o servicio..." />
        </Suspense>
        <Suspense fallback={null}>
          <VaultFilters
            companies={companies}
            services={services}
            creators={creators}
            showAccess={!admin}
          />
        </Suspense>
      </div>

      {q && (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)" }}>
          {totalEntries} resultado{totalEntries !== 1 ? "s" : ""} para &ldquo;{q}&rdquo;
        </p>
      )}

      <VaultList
        entries={entries.map((e) => ({
          ...e,
          createdAt: e.createdAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
        }))}
        currentUserId={session.user.id}
        searchQuery={q}
      />

      <Pagination
        totalItems={totalEntries}
        currentPage={page}
        pageSize={pageSize}
        params={params}
        basePath="/boveda"
      />
    </div>
  );
}
