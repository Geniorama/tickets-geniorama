import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireCan } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { PayrollManager } from "@/components/billing/payroll-manager";

export const metadata = { title: "Nómina" };

const inputMes: React.CSSProperties = {
  padding: "0.45rem 0.6rem", fontSize: "0.8125rem", borderRadius: "0.5rem",
  border: "1px solid var(--app-border)", backgroundColor: "var(--app-bg)", color: "var(--app-body-text)",
};

export default async function NominaPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  await requireCan("FACTURACION", "gestionar");
  const { mes } = await searchParams;
  const hoy = new Date();
  const period = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes)
    ? mes
    : `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = period.split("-").map(Number);

  const [filas, equipo] = await Promise.all([
    prisma.payrollEntry.findMany({ where: { period: new Date(y, m - 1, 1) }, orderBy: { personName: "asc" } }),
    prisma.user.findMany({ where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] } }, select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <Link href="/gerencial" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.875rem", color: "var(--app-text-muted)", textDecoration: "none", marginBottom: "1rem" }}>
        <ArrowLeft style={{ width: "1rem", height: "1rem" }} /> Volver al tablero
      </Link>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>Nómina</h1>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", margin: "0.25rem 0 1.25rem" }}>
        Cada registro crea su costo de tipo «Personal» en <Link href="/gerencial/costos" style={{ color: "#fd1384" }}>Costos</Link>, así que el margen bruto y la utilidad del tablero la incluyen sin captura doble. Borrar un registro borra su costo.
      </p>

      <form method="get" style={{ display: "flex", alignItems: "flex-end", gap: "0.6rem", marginBottom: "1.25rem" }}>
        <label style={{ fontSize: "0.75rem", color: "var(--app-text-muted)" }}>Mes<br />
          <input name="mes" type="month" defaultValue={period} style={inputMes} />
        </label>
        <button type="submit" style={{ padding: "0.45rem 0.9rem", fontSize: "0.8125rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#fd1384", color: "#fff", cursor: "pointer" }}>Ver</button>
      </form>

      <PayrollManager
        period={period}
        sugerencias={equipo.map((u) => u.name)}
        filas={filas.map((f) => ({ id: f.id, personName: f.personName, baseSalary: f.baseSalary, extras: f.extras, contributions: f.contributions, total: f.total }))}
      />
    </div>
  );
}
