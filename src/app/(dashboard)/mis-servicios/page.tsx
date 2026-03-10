import { getRequiredSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/roles";
import { isStaff } from "@/lib/auth-helpers";
import { ServiceCard } from "@/components/services/service-card";

export const metadata = { title: "Mis servicios — Geniorama Tickets" };

export default async function MisServiciosPage() {
  const session = await getRequiredSession();
  const { id: userId, role } = session.user;
  const admin = isAdmin(role);
  const staff = isStaff(role);

  // Staff/admin can see this page too (redirected from client context or direct access)
  // But the main audience is CLIENTE. Staff sees all services for their companies.
  let companyIds: string[] = [];

  if (admin || staff) {
    // Redirect admins to the full admin view
    redirect("/admin/servicios");
  }

  // CLIENTE: get their company ids
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { companies: { select: { id: true, name: true } } },
  });
  companyIds = (user?.companies ?? []).map((c) => c.id);

  if (companyIds.length === 0) {
    return (
      <div style={{ padding: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "1.5rem" }}>Mis servicios</h1>
        <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "3rem", textAlign: "center" }}>
          <p style={{ color: "var(--app-text-muted)" }}>No tienes empresas asociadas.</p>
        </div>
      </div>
    );
  }

  const services = await prisma.service.findMany({
    where: { companyId: { in: companyIds }, isActive: true },
    include: { company: { select: { id: true, name: true } } },
    orderBy: [{ type: "asc" }, { dueDate: "asc" }],
  });

  const showCompany = companyIds.length > 1;

  // Count expiring (within 30 days) and expired
  const now = new Date();
  const expiring = services.filter((s) => s.dueDate && s.dueDate > now && (s.dueDate.getTime() - now.getTime()) <= 30 * 86400000).length;
  const expired  = services.filter((s) => s.dueDate && s.dueDate < now).length;

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1200px" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>Mis servicios</h1>
        {(expiring > 0 || expired > 0) && (
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            {expired > 0 && (
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, padding: "0.25rem 0.75rem", borderRadius: "9999px", backgroundColor: "rgba(239,68,68,0.12)", color: "#dc2626" }}>
                ⚠️ {expired} vencido{expired !== 1 ? "s" : ""}
              </span>
            )}
            {expiring > 0 && (
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, padding: "0.25rem 0.75rem", borderRadius: "9999px", backgroundColor: "rgba(245,158,11,0.12)", color: "#b45309" }}>
                🕐 {expiring} por vencer
              </span>
            )}
          </div>
        )}
      </div>

      {services.length === 0 ? (
        <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "3rem", textAlign: "center" }}>
          <p style={{ color: "var(--app-text-muted)" }}>No hay servicios registrados aún.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0.75rem" }}>
          {services.map((s) => (
            <ServiceCard key={s.id} service={s} showCompany={showCompany} showNotes={false} />
          ))}
        </div>
      )}
    </div>
  );
}
