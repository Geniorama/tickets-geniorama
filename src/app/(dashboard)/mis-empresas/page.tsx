import { getRequiredSession } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import { Building2, CheckCircle2, XCircle } from "lucide-react";

export const metadata = { title: "Mis empresas — Geniorama Tickets" };

export default async function MisEmpresasPage() {
  const session = await getRequiredSession();
  if (session.user.role !== "CLIENTE") redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      companies: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          type: true,
          taxId: true,
          logoUrl: true,
          isActive: true,
          parent: { select: { name: true } },
          plans: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      },
    },
  });

  const companies = user?.companies ?? [];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis empresas</h1>

      {companies.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <p className="text-sm font-medium text-amber-800">Sin empresas asignadas</p>
          <p className="text-sm text-amber-700 mt-1">
            Contacta a tu administrador para que te asigne una empresa.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {companies.map((company) => (
            <div
              key={company.id}
              className={`bg-white rounded-xl border p-6 flex items-start gap-5 ${
                company.isActive ? "border-gray-200" : "border-gray-100 opacity-60"
              }`}
            >
              {/* Logo */}
              <div className="shrink-0 w-14 h-14 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                {company.logoUrl ? (
                  <Image
                    src={company.logoUrl}
                    alt={company.name}
                    width={56}
                    height={56}
                    className="object-contain"
                  />
                ) : (
                  <Building2 className="w-6 h-6 text-gray-400" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h2 className="text-base font-semibold text-gray-900 truncate">
                    {company.name}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 ${
                      company.type === "AGENCIA"
                        ? "bg-purple-50 text-purple-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {company.type === "AGENCIA" ? "Agencia" : "Empresa"}
                  </span>
                  {company.isActive ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      Activa
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 shrink-0">
                      <XCircle className="w-3 h-3" />
                      Inactiva
                    </span>
                  )}
                </div>

                {company.parent && (
                  <p className="text-xs text-gray-500 mb-1">
                    Agencia: <span className="font-medium">{company.parent.name}</span>
                  </p>
                )}

                {company.taxId && (
                  <p className="text-xs text-gray-500">
                    RFC / Tax ID: <span className="font-medium">{company.taxId}</span>
                  </p>
                )}

                {company.plans.length > 0 && (
                  <p className="text-xs text-indigo-600 mt-2">
                    {company.plans.length} plan{company.plans.length !== 1 ? "es" : ""} activo{company.plans.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
