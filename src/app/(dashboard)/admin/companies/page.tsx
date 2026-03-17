import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CompanyTable } from "@/components/admin/company-table";

export const metadata = { title: "Empresas — Geniorama Tickets" };

export default async function CompaniesPage() {
  await requireRole(["ADMINISTRADOR"]);

  // Traer agencias con sus subempresas anidadas
  const agencies = await prisma.company.findMany({
    where: { type: "AGENCIA" },
    orderBy: { name: "asc" },
    include: {
      subCompanies: {
        orderBy: { name: "asc" },
        include: { _count: { select: { users: true } } },
      },
      _count: { select: { users: true } },
    },
  });

  // Empresas sin agencia (tipo EMPRESA sin parentId)
  const standalone = await prisma.company.findMany({
    where: { type: "EMPRESA", parentId: null },
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true } } },
  });

  type CompanyRow = {
    id: string;
    name: string;
    type: string;
    taxId: string | null;
    logoUrl: string | null;
    isActive: boolean;
    parentName?: string;
    userCount: number;
    indent?: boolean;
  };

  const rows: CompanyRow[] = [];

  for (const agency of agencies) {
    rows.push({
      id: agency.id,
      name: agency.name,
      type: "AGENCIA",
      taxId: agency.taxId,
      logoUrl: agency.logoUrl,
      isActive: agency.isActive,
      userCount: agency._count.users,
    });
    for (const sub of agency.subCompanies) {
      rows.push({
        id: sub.id,
        name: sub.name,
        type: "EMPRESA",
        taxId: sub.taxId,
        logoUrl: sub.logoUrl,
        isActive: sub.isActive,
        parentName: agency.name,
        userCount: sub._count.users,
        indent: true,
      });
    }
  }

  for (const company of standalone) {
    rows.push({
      id: company.id,
      name: company.name,
      type: "EMPRESA",
      taxId: company.taxId,
      logoUrl: company.logoUrl,
      isActive: company.isActive,
      userCount: company._count.users,
    });
  }

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

      <CompanyTable rows={rows} />
    </div>
  );
}
