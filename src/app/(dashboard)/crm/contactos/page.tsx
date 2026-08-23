import Link from "next/link";
import { Plus, Mail, Phone, Star, ShieldCheck, Building2 } from "lucide-react";
import { requireCan, can } from "@/lib/access/can";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_STAGE_COLORS, ACCOUNT_STAGE_LABELS } from "@/lib/crm/accounts";
import { SearchInput } from "@/components/ui/search-input";
import { fullName } from "@/lib/crm/contact-name";
import { Suspense } from "react";

export const metadata = { title: "Contactos" };

/**
 * Todas las personas del CRM en un solo sitio.
 *
 * Los contactos cuelgan de una cuenta, pero buscarlos exigía saber de cuál —y
 * casi siempre se recuerda antes el nombre de la persona que el de su empresa.
 */
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; portal?: string }>;
}) {
  const session = await requireCan("CRM", "ver");
  const canCreate = await can(session.user, "CRM", "crear");
  const { q, portal } = await searchParams;

  const busqueda = q?.trim();
  const soloPortal = portal === "1";

  const contactos = await prisma.contact.findMany({
    where: {
      isActive: true,
      ...(soloPortal ? { userId: { not: null } } : {}),
      ...(busqueda
        ? {
            OR: [
              { firstName: { contains: busqueda, mode: "insensitive" as const } },
              { lastName:  { contains: busqueda, mode: "insensitive" as const } },
              { email: { contains: busqueda, mode: "insensitive" as const } },
              { phone: { contains: busqueda, mode: "insensitive" as const } },
              { company: { name: { contains: busqueda, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    orderBy: [{ company: { name: "asc" } }, { isPrimary: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true, firstName: true, lastName: true, email: true, phone: true, position: true,
      isPrimary: true, userId: true,
      company: { select: { id: true, name: true, stage: true } },
    },
  });

  const conPortal = contactos.filter((c) => c.userId).length;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Contactos
          </h1>
          <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginTop: "0.25rem" }}>
            Las personas con las que se habla en cada cuenta.
            {conPortal > 0 && ` ${conPortal} con acceso al portal.`}
          </p>
        </div>

        {canCreate && (
          <Link
            href="/crm/contactos/nuevo"
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              backgroundColor: "#fd1384", color: "#fff", borderRadius: "0.5rem",
              padding: "0.55rem 1rem", fontSize: "0.875rem", fontWeight: 500, textDecoration: "none",
            }}
          >
            <Plus style={{ width: "1rem", height: "1rem" }} />
            Nuevo contacto
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Suspense fallback={<div style={{ height: "2.375rem" }} />}>
          <SearchInput placeholder="Buscar por nombre, correo o empresa..." />
        </Suspense>
        <Link
          href={soloPortal ? "/crm/contactos" : "/crm/contactos?portal=1"}
          style={{
            fontSize: "0.8125rem", padding: "0.45rem 0.85rem", borderRadius: "0.5rem",
            border: `1px solid ${soloPortal ? "#22c55e" : "var(--app-border)"}`,
            color: soloPortal ? "#22c55e" : "var(--app-nav-text)",
            textDecoration: "none", whiteSpace: "nowrap",
          }}
        >
          {soloPortal ? "Ver todos" : "Solo con portal"}
        </Link>
      </div>

      {contactos.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
          {busqueda ? `Nadie coincide con «${busqueda}».` : "Todavía no hay contactos."}
        </p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(19rem, 1fr))", gap: "0.75rem" }}>
          {contactos.map((c) => (
            <Link
              key={c.id}
              href={`/crm/${c.company.id}`}
              style={{
                display: "block", textDecoration: "none",
                backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
                borderRadius: "0.7rem", padding: "0.9rem 1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)" }}>
                  {fullName(c)}
                </span>
                {c.isPrimary && (
                  <span title="Contacto principal" style={{ display: "inline-flex", alignItems: "center", gap: "0.15rem", fontSize: "0.6875rem", color: "#f59e0b" }}>
                    <Star style={{ width: "0.7rem", height: "0.7rem", fill: "#f59e0b" }} />
                    Principal
                  </span>
                )}
                {c.userId && (
                  <span title="Tiene acceso al portal" style={{ display: "inline-flex", alignItems: "center", gap: "0.2rem", fontSize: "0.6875rem", color: "#22c55e" }}>
                    <ShieldCheck style={{ width: "0.75rem", height: "0.75rem" }} />
                    Portal
                  </span>
                )}
              </div>

              {c.position && (
                <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.1rem" }}>
                  {c.position}
                </p>
              )}

              <p style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", marginTop: "0.45rem", color: "var(--app-nav-text)" }}>
                <Building2 style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0, color: "var(--app-icon-color)" }} />
                {c.company.name}
                <span style={{ color: ACCOUNT_STAGE_COLORS[c.company.stage], fontWeight: 600 }}>
                  · {ACCOUNT_STAGE_LABELS[c.company.stage]}
                </span>
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.4rem" }}>
                {c.email && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "#fd1384" }}>
                    <Mail style={{ width: "0.75rem", height: "0.75rem" }} />
                    {c.email}
                  </span>
                )}
                {c.phone && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "var(--app-text-muted)" }}>
                    <Phone style={{ width: "0.75rem", height: "0.75rem" }} />
                    {c.phone}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
