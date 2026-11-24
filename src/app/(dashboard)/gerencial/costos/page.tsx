import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { periodoDesdeParams } from "@/lib/billing/categories";
import { formatDate } from "@/lib/format-date";
import { ExpenseManager } from "@/components/billing/expense-manager";

export const metadata = { title: "Costos" };

export default async function CostosPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  await requireCan("FACTURACION", "gestionar");
  const { desde, hasta } = await searchParams;
  const periodo = periodoDesdeParams(desde, hasta);

  const costos = await prisma.expense.findMany({
    where: { incurredOn: { gte: periodo.desde, lte: periodo.hasta } },
    orderBy: { incurredOn: "desc" },
    include: { payroll: { select: { id: true } } },
  });

  return (
    <div>
      <Link href="/gerencial" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", color: "var(--app-text-muted)", textDecoration: "none", marginBottom: "1rem" }}>
        <ArrowLeft style={{ width: "1rem", height: "1rem" }} /> Volver al tablero
      </Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>Costos</h1>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", margin: "0.25rem 0 1.25rem" }}>
        Costos causados entre el {formatDate(periodo.desde)} y el {formatDate(periodo.hasta)}. Alimentan el margen bruto y la utilidad operativa del tablero gerencial. Los costos de personal de cada mes salen de la <Link href="/gerencial/nomina" style={{ color: "#fd1384" }}>nómina</Link>.
      </p>
      <ExpenseManager
        hoy={new Date().toISOString().slice(0, 10)}
        costos={costos.map((c) => ({
          id: c.id, concept: c.concept, kind: c.kind, amount: c.amount,
          fecha: formatDate(c.incurredOn), supplier: c.supplier, nomina: c.payroll !== null,
        }))}
      />
    </div>
  );
}
