import { getRequiredSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getPlanUsedHours } from "@/lib/plans.server";
import { getEffectiveExpiresAt } from "@/lib/plans";
import { ReportView } from "@/components/reportes/report-view";
import type { TicketRow, PlanRow, CompanyOption, PlanOption } from "@/components/reportes/report-view";

export const metadata = { title: "Reportes — Geniorama Tickets" };

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; companyId?: string; planId?: string }>;
}) {
  const session = await getRequiredSession();
  const { role, id: userId } = session.user;
  const isClient = role === "CLIENTE";

  const { from, to, companyId, planId } = await searchParams;

  const fromDate = from ? new Date(from + "T00:00:00") : undefined;
  const toDate   = to   ? new Date(to   + "T23:59:59") : undefined;

  const dateFilter =
    fromDate || toDate
      ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {};

  // ── Build ticket filter ────────────────────────────────────
  let ticketFilter: Record<string, unknown> = { ...dateFilter };

  if (isClient) {
    ticketFilter = { ...ticketFilter, OR: [{ clientId: userId }, { createdById: userId }] };
  } else {
    if (planId) {
      ticketFilter = { ...ticketFilter, planId };
    } else if (companyId) {
      ticketFilter = {
        ...ticketFilter,
        client: { companies: { some: { id: companyId } } },
      };
    }
  }

  // ── Tickets ────────────────────────────────────────────────
  const rawTickets = await prisma.ticket.findMany({
    where: ticketFilter,
    take: 500,
    orderBy: { createdAt: "desc" },
    include: {
      client:     { select: { name: true } },
      assignedTo: { select: { name: true } },
      plan:       { select: { name: true, type: true } },
      timeEntries: {
        where: { stoppedAt: { not: null } },
        select: { startedAt: true, stoppedAt: true },
      },
    },
  });

  const tickets: TicketRow[] = rawTickets.map((t) => ({
    id:         t.id,
    title:      t.title,
    status:     t.status,
    priority:   t.priority,
    category:   t.category,
    createdAt:  t.createdAt.toISOString(),
    client:     t.client,
    assignedTo: t.assignedTo,
    plan:       t.plan,
    totalMs:    t.timeEntries.reduce(
      (acc, e) => acc + (e.stoppedAt!.getTime() - e.startedAt.getTime()),
      0,
    ),
  }));

  // ── Plans ──────────────────────────────────────────────────
  let plans: PlanRow[] = [];
  let companyOptions: CompanyOption[] = [];
  let planOptions: PlanOption[] = [];

  if (isClient) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        companies: {
          select: {
            id: true,
            name: true,
            plans: {
              select: {
                id: true, name: true, type: true,
                totalHours: true, durationDays: true,
                startedAt: true, expiresAt: true, isActive: true,
                _count: { select: { tickets: true } },
              },
            },
          },
        },
      },
    });

    const allPlans = user?.companies.flatMap((c) =>
      c.plans.map((p) => ({ ...p, companyId: c.id, company: { name: c.name } })),
    ) ?? [];

    plans = await Promise.all(
      allPlans.map(async (p) => {
        const usedHours = p.type === "BOLSA_HORAS" ? await getPlanUsedHours(p.id) : 0;
        const expiry    = getEffectiveExpiresAt(p);
        return {
          id: p.id, name: p.name, type: p.type,
          companyId: p.companyId, company: p.company,
          totalHours: p.totalHours, usedHours,
          effectiveExpiresAt: expiry?.toISOString() ?? null,
          isActive: p.isActive, ticketCount: p._count.tickets,
        };
      }),
    );
  } else {
    // Plan filter for the report section
    const planWhereFilter = planId
      ? { id: planId }
      : companyId
        ? { companyId }
        : {};

    const rawPlans = await prisma.plan.findMany({
      where: planWhereFilter,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, type: true,
        totalHours: true, durationDays: true,
        startedAt: true, expiresAt: true, isActive: true,
        companyId: true,
        company: { select: { name: true } },
        _count: { select: { tickets: true } },
      },
    });

    plans = await Promise.all(
      rawPlans.map(async (p) => {
        const usedHours = p.type === "BOLSA_HORAS" ? await getPlanUsedHours(p.id) : 0;
        const expiry    = getEffectiveExpiresAt(p);
        return {
          id: p.id, name: p.name, type: p.type,
          companyId: p.companyId, company: p.company,
          totalHours: p.totalHours, usedHours,
          effectiveExpiresAt: expiry?.toISOString() ?? null,
          isActive: p.isActive, ticketCount: p._count.tickets,
        };
      }),
    );

    // Options for filter dropdowns
    const companies = await prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    companyOptions = companies;

    const allPlanOptions = await prisma.plan.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, companyId: true },
    });
    planOptions = allPlanOptions;
  }

  return (
    <ReportView
      tickets={tickets}
      plans={plans}
      isClient={isClient}
      initialFrom={from ?? ""}
      initialTo={to ?? ""}
      initialCompanyId={companyId ?? ""}
      initialPlanId={planId ?? ""}
      companyOptions={companyOptions}
      planOptions={planOptions}
    />
  );
}
