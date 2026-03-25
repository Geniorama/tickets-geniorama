import { getRequiredSession } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getPlanUsedHours } from "@/lib/plans.server";
import {
  getEffectiveExpiresAt,
  isPlanEffectivelyActive,
  daysUntilExpiry,
  PLAN_EXPIRY_WARNING_DAYS,
  formatHours,
} from "@/lib/plans";
import { formatDate } from "@/lib/format-date";
import { Clock, CalendarClock, CheckCircle2, XCircle, AlertCircle, AlertTriangle } from "lucide-react";

export const metadata = { title: "Mis planes — Geniorama Tickets" };

function getRemainingDays(expiry: Date): number {
  return Math.ceil((expiry.getTime() - Date.now()) / 86_400_000);
}

type PlanRow = {
  id: string;
  name: string;
  type: string;
  totalHours: number | null;
  durationDays: number | null;
  startedAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
  company: { name: string };
};

function StatusBadge({
  plan,
  usedHours,
}: {
  plan: PlanRow;
  usedHours: number;
}) {
  if (!plan.isActive) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        <XCircle className="w-3 h-3" />
        Inactivo
      </span>
    );
  }
  const expiry = getEffectiveExpiresAt(plan);
  if (expiry && expiry < new Date()) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
        <XCircle className="w-3 h-3" />
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
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
        <AlertCircle className="w-3 h-3" />
        Agotado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
      <CheckCircle2 className="w-3 h-3" />
      Activo
    </span>
  );
}

export default async function MisplanesPage() {
  const session = await getRequiredSession();
  if (session.user.role !== "CLIENTE") redirect("/dashboard");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      companies: {
        select: {
          name: true,
          plans: {
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
            },
          },
        },
      },
    },
  });

  // Flatten plans keeping company name
  const rawPlans: PlanRow[] =
    user?.companies.flatMap((company) =>
      company.plans.map((plan) => ({ ...plan, company: { name: company.name } }))
    ) ?? [];

  // Compute used hours for BOLSA_HORAS plans
  const usedHoursMap: Record<string, number> = {};
  await Promise.all(
    rawPlans
      .filter((p) => p.type === "BOLSA_HORAS")
      .map(async (p) => {
        usedHoursMap[p.id] = await getPlanUsedHours(p.id);
      })
  );

  // Sort: active first, then expired/exhausted
  const plans = rawPlans.sort((a, b) => {
    const aActive = isPlanEffectivelyActive(a, usedHoursMap[a.id] ?? 0);
    const bActive = isPlanEffectivelyActive(b, usedHoursMap[b.id] ?? 0);
    return aActive === bActive ? 0 : aActive ? -1 : 1;
  });

  // ── Clasificar planes para alertas ─────────────────────────────────────────
  const now = new Date();
  const expiredPlans    = plans.filter((p) => {
    const expiry = getEffectiveExpiresAt(p);
    return p.isActive && expiry !== null && expiry < now;
  });
  const exhaustedPlans  = plans.filter((p) => {
    const usedHours = usedHoursMap[p.id] ?? 0;
    return p.isActive && p.type === "BOLSA_HORAS" && p.totalHours !== null && usedHours >= p.totalHours;
  });
  const expiringPlans   = plans.filter((p) => {
    const days = daysUntilExpiry(p);
    return p.isActive && days !== null && days > 0 && days <= PLAN_EXPIRY_WARNING_DAYS;
  }).sort((a, b) => (daysUntilExpiry(a) ?? 0) - (daysUntilExpiry(b) ?? 0));

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mis planes</h1>

      {/* ── Alertas ── */}
      {(expiredPlans.length > 0 || exhaustedPlans.length > 0 || expiringPlans.length > 0) && (
        <div className="space-y-3 mb-6">
          {expiredPlans.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  {expiredPlans.length === 1 ? "1 plan vencido" : `${expiredPlans.length} planes vencidos`}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {expiredPlans.map((p) => (
                    <li key={p.id} className="text-sm text-red-700">
                      {p.name} — {p.company.name}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-red-600 mt-1.5">Contacta a tu agente para renovar.</p>
              </div>
            </div>
          )}

          {exhaustedPlans.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl">
              <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-800">
                  {exhaustedPlans.length === 1 ? "Bolsa de horas agotada" : `${exhaustedPlans.length} bolsas de horas agotadas`}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {exhaustedPlans.map((p) => (
                    <li key={p.id} className="text-sm text-orange-700">
                      {p.name} — {p.company.name}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-orange-600 mt-1.5">Contacta a tu agente para recargar horas.</p>
              </div>
            </div>
          )}

          {expiringPlans.length > 0 && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  {expiringPlans.length === 1 ? "1 plan próximo a vencer" : `${expiringPlans.length} planes próximos a vencer`}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {expiringPlans.map((p) => {
                    const days = daysUntilExpiry(p)!;
                    return (
                      <li key={p.id} className="text-sm text-amber-700">
                        {p.name} — vence en {days} día{days !== 1 ? "s" : ""}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {plans.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <p className="text-sm font-medium text-amber-800">Sin planes activos</p>
          <p className="text-sm text-amber-700 mt-1">
            Contacta a tu agente para activar un plan de soporte o bolsa de horas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const usedHours = usedHoursMap[plan.id] ?? 0;
            const expiry = getEffectiveExpiresAt(plan);
            const remainingDays = expiry ? getRemainingDays(expiry) : null;
            const remainingHours =
              plan.type === "BOLSA_HORAS" && plan.totalHours !== null
                ? Math.max(0, plan.totalHours - usedHours)
                : null;
            const pct =
              plan.type === "BOLSA_HORAS" && plan.totalHours !== null && plan.totalHours > 0
                ? Math.min(100, Math.round((usedHours / plan.totalHours) * 100))
                : null;
            const isActive = isPlanEffectivelyActive(plan, usedHours);
            const days = daysUntilExpiry(plan);
            const isExpiringSoon = isActive && days !== null && days > 0 && days <= PLAN_EXPIRY_WARNING_DAYS;

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-xl border p-6 ${
                  !isActive          ? "border-gray-100 opacity-70" :
                  isExpiringSoon     ? "border-amber-300" :
                                       "border-gray-200"
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">{plan.company.name}</p>
                    <h2 className="text-base font-semibold text-gray-900">{plan.name}</h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {plan.type === "BOLSA_HORAS" ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                        Bolsa de horas
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                        Soporte mensual
                      </span>
                    )}
                    <StatusBadge plan={plan} usedHours={usedHours} />
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex flex-wrap gap-6">
                  {/* Expiry */}
                  <div className="flex items-start gap-2">
                    <CalendarClock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-gray-500">Caducidad</p>
                      {expiry ? (
                        <>
                          <p className="text-sm font-medium text-gray-800">
                            {formatDate(expiry)}
                          </p>
                          {remainingDays !== null && remainingDays > 0 && isActive && (
                            <p className="text-xs text-gray-500">
                              {remainingDays} día{remainingDays !== 1 ? "s" : ""} restante{remainingDays !== 1 ? "s" : ""}
                            </p>
                          )}
                          {remainingDays !== null && remainingDays <= 0 && (
                            <p className="text-xs text-red-600">Expirado</p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm font-medium text-gray-800">Sin caducidad</p>
                      )}
                    </div>
                  </div>

                  {/* Hours (BOLSA_HORAS only) */}
                  {plan.type === "BOLSA_HORAS" && plan.totalHours !== null && (
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">Horas consumidas</p>
                        <p className="text-sm font-medium text-gray-800">
                          {formatHours(usedHours)}{" "}
                          <span className="text-gray-400 font-normal">
                            de {formatHours(plan.totalHours)}
                          </span>
                        </p>
                        {remainingHours !== null && isActive && (
                          <p className="text-xs text-gray-500">
                            {formatHours(remainingHours)} restante{remainingHours !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress bar (BOLSA_HORAS) */}
                {pct !== null && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Uso de horas</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          pct >= 100
                            ? "bg-red-500"
                            : pct >= 80
                            ? "bg-orange-400"
                            : "bg-indigo-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
