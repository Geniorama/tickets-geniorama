import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, Building2 } from "lucide-react";
import { DeleteCompanyButton } from "@/components/admin/delete-company-button";

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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Logo</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Tipo</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Agencia</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">NIT / RUC</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Usuarios</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No hay empresas registradas.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className={`hover:bg-gray-50 ${row.indent ? "bg-gray-50/40" : ""}`}>
                <td className="px-4 py-3">
                  <div className={`flex items-center ${row.indent ? "pl-4" : ""}`}>
                    {row.indent && (
                      <span className="text-gray-300 mr-2 text-base leading-none">└</span>
                    )}
                    <div className="w-10 h-10 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                      {row.logoUrl ? (
                        <Image
                          src={row.logoUrl}
                          alt={row.name}
                          width={40}
                          height={40}
                          className="object-contain p-1"
                        />
                      ) : (
                        <Building2 className="w-5 h-5 text-gray-300" />
                      )}
                    </div>
                  </div>
                </td>
                <td className={`px-4 py-3 font-medium text-gray-900 ${row.indent ? "pl-4" : ""}`}>
                  {row.name}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    row.type === "AGENCIA"
                      ? "bg-purple-50 text-purple-700"
                      : "bg-blue-50 text-blue-700"
                  }`}>
                    {row.type === "AGENCIA" ? "Agencia" : "Empresa"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {row.parentName ?? "—"}
                </td>
                <td className="px-4 py-3 text-gray-500">{row.taxId ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{row.userCount}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    row.isActive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}>
                    {row.isActive ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/admin/companies/${row.id}/edit`}
                      className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </Link>
                    <DeleteCompanyButton companyId={row.id} companyName={row.name} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
