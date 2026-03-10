import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getPlanUsedHours } from "@/lib/plans.server";
import { getEffectiveExpiresAt, isPlanEffectivelyActive, formatHours } from "@/lib/plans";
import { formatDate } from "@/lib/format-date";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";

export const metadata = { title: "Planes — Geniorama Tickets" };

export default async function PlansPage() {
  await requireRole(["ADMINISTRADOR"]);

  const plans = await prisma.plan.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      totalHours: true,
      durationDays: true,
      startedAt: true,
      expiresAt: true,
      isActive: true,
      company: { select: { name: true } },
    },
  });

  // Compute used hours for BOLSA_HORAS plans
  const usedHoursMap: Record<string, number> = {};
  await Promise.all(
    plans
      .filter((p) => p.type === "BOLSA_HORAS")
      .map(async (p) => {
        usedHoursMap[p.id] = await getPlanUsedHours(p.id);
      })
  );

  function getStatusBadge(plan: (typeof plans)[number], usedHours: number) {
    if (!plan.isActive) {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
          Inactivo
        </span>
      );
    }
    const expiry = getEffectiveExpiresAt(plan);
    if (expiry && expiry < new Date()) {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700">
          Expirado
        </span>
      );
    }
    if (
      plan.type === "BOLSA_HORAS" &&
      plan.totalHours !== null &&
      usedHours >= plan.totalHours
    ) {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-700">
          Agotado
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
        Activo
      </span>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Planes</h1>
        <Link
          href="/admin/plans/new"
          className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nuevo plan
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Nombre</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Empresa</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Tipo</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Horas</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Caducidad</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {plans.map((plan) => {
              const usedHours = usedHoursMap[plan.id] ?? 0;
              const expiry = getEffectiveExpiresAt(plan);
              const effectivelyActive = isPlanEffectivelyActive(plan, usedHours);
              void effectivelyActive; // used in status badge logic

              return (
                <tr key={plan.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{plan.name}</td>
                  <td className="px-4 py-3 text-gray-600">{plan.company.name}</td>
                  <td className="px-4 py-3">
                    {plan.type === "BOLSA_HORAS" ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                        Bolsa de horas
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        Soporte mensual
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {plan.type === "BOLSA_HORAS" && plan.totalHours !== null ? (
                      <span>
                        {formatHours(usedHours)} / {formatHours(plan.totalHours)}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {expiry ? formatDate(expiry) : <span className="text-gray-400">Sin caducidad</span>}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(plan, usedHours)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/plans/${plan.id}/edit`}
                      className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
            {plans.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No hay planes creados todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
