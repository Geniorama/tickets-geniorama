import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ServiceCard } from "@/components/services/service-card";

export const metadata = { title: "Servicios — Geniorama Tickets" };

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  await requireRole(["ADMINISTRADOR"]);
  const params = await searchParams;
  const companyFilter = params.companyId;
  const typeFilter    = params.type;

  const [services, companies] = await Promise.all([
    prisma.service.findMany({
      where: {
        ...(companyFilter ? { companyId: companyFilter } : {}),
        ...(typeFilter    ? { type: typeFilter as never } : {}),
      },
      include: {
        company: { select: { id: true, name: true } },
      },
      orderBy: [{ companyId: "asc" }, { dueDate: "asc" }],
    }),
    prisma.company.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Group by company
  const grouped = new Map<string, { company: { id: string; name: string }; services: typeof services }>();
  for (const s of services) {
    const key = s.company.id;
    if (!grouped.has(key)) grouped.set(key, { company: s.company, services: [] });
    grouped.get(key)!.services.push(s);
  }

  const SERVICE_TYPES = [
    { value: "DOMINIO", label: "Dominio" },
    { value: "HOSTING", label: "Hosting" },
    { value: "CORREO",  label: "Correos" },
    { value: "SSL",     label: "SSL" },
    { value: "MANTENIMIENTO", label: "Mantenimiento" },
    { value: "OTRO",    label: "Otro" },
  ];

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1200px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", gap: "1rem", flexWrap: "wrap" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>Servicios</h1>
        <Link href="/admin/servicios/new"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", backgroundColor: "#fd1384", color: "#ffffff", padding: "0.5rem 1rem", borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none" }}>
          <Plus style={{ width: "1rem", height: "1rem" }} />
          Nuevo servicio
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <select name="companyId" defaultValue={companyFilter ?? ""}
          style={{ border: "1px solid var(--app-border)", borderRadius: "0.5rem", padding: "0.4rem 0.75rem", fontSize: "0.875rem", backgroundColor: "var(--app-card-bg)", color: "var(--app-body-text)", cursor: "pointer" }}>
          <option value="">Todas las empresas</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select name="type" defaultValue={typeFilter ?? ""}
          style={{ border: "1px solid var(--app-border)", borderRadius: "0.5rem", padding: "0.4rem 0.75rem", fontSize: "0.875rem", backgroundColor: "var(--app-card-bg)", color: "var(--app-body-text)", cursor: "pointer" }}>
          <option value="">Todos los tipos</option>
          {SERVICE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button type="submit"
          style={{ padding: "0.4rem 0.875rem", fontSize: "0.875rem", backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.5rem", color: "var(--app-body-text)", cursor: "pointer" }}>
          Filtrar
        </button>
        {(companyFilter || typeFilter) && (
          <Link href="/admin/servicios"
            style={{ padding: "0.4rem 0.875rem", fontSize: "0.875rem", color: "var(--app-text-muted)", textDecoration: "none" }}>
            Limpiar
          </Link>
        )}
      </form>

      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1.25rem" }}>
        {services.length} {services.length === 1 ? "servicio" : "servicios"}
      </p>

      {services.length === 0 ? (
        <div style={{ backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)", borderRadius: "0.75rem", padding: "3rem", textAlign: "center" }}>
          <p style={{ color: "var(--app-text-muted)" }}>No hay servicios registrados.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {[...grouped.values()].map(({ company, services: companyServices }) => (
            <section key={company.id}>
              <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--app-body-text)", marginBottom: "0.75rem" }}>
                {company.name}
                <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", fontWeight: 400, color: "var(--app-text-muted)" }}>
                  ({companyServices.length})
                </span>
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "0.75rem" }}>
                {companyServices.map((s) => (
                  <ServiceCard
                    key={s.id}
                    service={s}
                    showNotes
                    editHref={`/admin/servicios/${s.id}/edit`}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
