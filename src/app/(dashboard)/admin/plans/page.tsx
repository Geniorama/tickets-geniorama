import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getPlanUsedHours } from "@/lib/plans.server";
import { getEffectiveExpiresAt } from "@/lib/plans";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { PlansTable } from "@/components/admin/plans-table";

export const metadata = { title: "Planes — Geniorama Tickets" };

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireRole(["ADMINISTRADOR"]);
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const sortBy  = params.sortBy  ?? "createdAt";
  const sortDir = (params.sortDir === "asc" ? "asc" : "desc") as "asc" | "desc";

  const plansOrderBy: Record<string, unknown> = (() => {
    const d = sortDir;
    switch (sortBy) {
      case "name":      return { name: d };
      case "company":   return { company: { name: d } };
      case "type":      return { type: d };
      case "expiresAt": return { expiresAt: d };
      case "isActive":  return { isActive: d };
      default:          return { createdAt: d };
    }
  })();

  const baseParams = new URLSearchParams(params as Record<string, string>);
  baseParams.delete("sortBy");
  baseParams.delete("sortDir");
  baseParams.delete("page");
  const paramsStr = baseParams.toString();

  const plans = await prisma.plan.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { company: { name: { contains: q, mode: "insensitive" as const } } }] }
      : undefined,
    orderBy: plansOrderBy,
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

  const planRows = plans.map((plan) => {
    const usedHours = usedHoursMap[plan.id] ?? 0;
    const expiry = getEffectiveExpiresAt(plan);

    let statusBadge: { label: string; bg: string; color: string };
    if (!plan.isActive) {
      statusBadge = { label: "Inactivo", bg: "rgba(100,116,139,0.12)", color: "#64748b" };
    } else if (expiry && expiry < new Date()) {
      statusBadge = { label: "Expirado", bg: "rgba(239,68,68,0.12)", color: "#f87171" };
    } else if (plan.type === "BOLSA_HORAS" && plan.totalHours !== null && usedHours >= plan.totalHours) {
      statusBadge = { label: "Agotado", bg: "rgba(251,146,60,0.12)", color: "#fb923c" };
    } else {
      statusBadge = { label: "Activo", bg: "rgba(34,197,94,0.12)", color: "#22c55e" };
    }

    return {
      id: plan.id,
      name: plan.name,
      type: plan.type as "BOLSA_HORAS" | "SOPORTE_MENSUAL",
      totalHours: plan.totalHours,
      usedHours,
      expiryDate: expiry,
      isActive: plan.isActive,
      statusBadge,
      company: plan.company,
    };
  });

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

      <div style={{ marginBottom: "1rem" }}>
        <Suspense fallback={<div style={{ height: "2.375rem" }} />}>
          <SearchInput placeholder="Buscar planes..." />
        </Suspense>
      </div>

      <PlansTable plans={planRows} sortBy={sortBy} sortDir={sortDir} paramsStr={paramsStr} />
    </div>
  );
}
