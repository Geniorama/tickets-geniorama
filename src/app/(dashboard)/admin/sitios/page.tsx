import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, Globe, Building2, Pencil } from "lucide-react";
import { DeleteSiteButton } from "@/components/sites/delete-site-button";

export const metadata = { title: "Sitios y apps — Geniorama Tickets" };

export default async function SitiosPage() {
  await requireRole(["ADMINISTRADOR"]);

  const sites = await prisma.site.findMany({
    include: { company: { select: { name: true } } },
    orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
  });

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

      {sites.length === 0 ? (
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Sitio / App</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Dominio</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Empresa</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Docs</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sites.map((site) => (
                <tr key={site.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{site.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      <Globe className="w-3.5 h-3.5 text-gray-400" />
                      {site.domain}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-gray-600">
                      <Building2 className="w-3.5 h-3.5 text-gray-400" />
                      {site.company.name}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {site.documentation && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-blue-50 text-blue-700 font-medium">Docs</span>
                      )}
                      {site.architecture && (
                        <span className="px-1.5 py-0.5 rounded text-xs bg-purple-50 text-purple-700 font-medium">Arq.</span>
                      )}
                      {!site.documentation && !site.architecture && (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      site.isActive
                        ? "bg-green-50 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}>
                      {site.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/admin/sitios/${site.id}/edit`}
                        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar
                      </Link>
                      <DeleteSiteButton siteId={site.id} siteName={site.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
