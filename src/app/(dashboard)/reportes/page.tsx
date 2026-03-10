import { getRequiredSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getPlanUsedHours } from "@/lib/plans.server";
import { getEffectiveExpiresAt } from "@/lib/plans";
import { ReportView } from "@/components/reportes/report-view";
import type { TicketRow, PlanRow } from "@/components/reportes/report-view";

export const metadata = { title: "Reportes — Geniorama Tickets" };

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await getRequiredSession();
  const { role, id: userId } = session.user;

  // All roles can access, but only CLIENTE sees filtered data
  const { from, to } = await searchParams;

  const fromDate = from ? new Date(from + "T00:00:00") : undefined;
  const toDate   = to   ? new Date(to   + "T23:59:59") : undefined;

  const dateFilter =
    fromDate || toDate
      ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
      : {};

  const ticketFilter =
    role === "CLIENTE"
      ? { ...dateFilter, OR: [{ clientId: userId }, { createdById: userId }] }
      : dateFilter;

  // ── Tickets ────────────────────────────────────────────────
  const rawTickets = await prisma.ticket.findMany({
    where: ticketFilter,
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

  if (role === "CLIENTE") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        companies: {
          select: {
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
      c.plans.map((p) => ({ ...p, company: { name: c.name } })),
    ) ?? [];

    plans = await Promise.all(
      allPlans.map(async (p) => {
        const usedHours = p.type === "BOLSA_HORAS" ? await getPlanUsedHours(p.id) : 0;
        const expiry    = getEffectiveExpiresAt(p);
        return {
          id: p.id, name: p.name, type: p.type,
          company: p.company, totalHours: p.totalHours,
          usedHours, effectiveExpiresAt: expiry?.toISOString() ?? null,
          isActive: p.isActive, ticketCount: p._count.tickets,
        };
      }),
    );
  } else {
    const rawPlans = await prisma.plan.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, type: true,
        totalHours: true, durationDays: true,
        startedAt: true, expiresAt: true, isActive: true,
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
          company: p.company, totalHours: p.totalHours,
          usedHours, effectiveExpiresAt: expiry?.toISOString() ?? null,
          isActive: p.isActive, ticketCount: p._count.tickets,
        };
      }),
    );
  }

  return (
    <ReportView
      tickets={tickets}
      plans={plans}
      isClient={role === "CLIENTE"}
      initialFrom={from ?? ""}
      initialTo={to ?? ""}
    />
  );
}
