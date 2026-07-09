import { getRequiredSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getClientActivePlan } from "@/lib/plans.server";
import { SchedulingCard } from "@/components/collaborator/scheduling-card";
import type { SchedulingLinkData, SchedulingCategory } from "@/lib/scheduling";
import { CalendarClock, Lock } from "lucide-react";

export const metadata = { title: "Agendar" };

interface Collaborator {
  id: string;
  name: string;
  cargo: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isProjectManager: boolean;
  isSupportAgent: boolean;
  schedulingLinks: SchedulingLinkData[];
}

function Section({
  title,
  description,
  people,
  category,
}: {
  title: string;
  description: string;
  people: Collaborator[];
  category: SchedulingCategory;
}) {
  return (
    <section style={{ marginBottom: "2.5rem" }}>
      <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "0.25rem" }}>{title}</h2>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "1rem" }}>{description}</p>
      {people.length === 0 ? (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", fontStyle: "italic" }}>
          No hay contactos disponibles por ahora.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "1rem",
          }}
        >
          {people.map((p) => (
            <SchedulingCard
              key={p.id}
              name={p.name}
              cargo={p.cargo}
              bio={p.bio}
              avatarUrl={p.avatarUrl}
              links={p.schedulingLinks.filter((l) => l.category === category)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function AgendarPage() {
  const session = await getRequiredSession();

  // El agendamiento de soporte para clientes requiere un paquete (plan) activo.
  const isClient = session.user.role === "CLIENTE";
  const supportAvailable = !isClient || (await getClientActivePlan(session.user.id)) !== null;

  const collaboratorsRaw = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ isProjectManager: true }, { isSupportAgent: true }],
    },
    select: {
      id: true,
      name: true,
      cargo: true,
      bio: true,
      avatarUrl: true,
      isProjectManager: true,
      isSupportAgent: true,
      schedulingLinks: {
        select: { id: true, title: true, description: true, url: true, category: true },
        orderBy: [{ category: "asc" }, { position: "asc" }],
      },
    },
    orderBy: { name: "asc" },
  });

  const collaborators = collaboratorsRaw as Collaborator[];
  const managers = collaborators.filter((c) => c.isProjectManager);
  const agents = collaborators.filter((c) => c.isSupportAgent);

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock style={{ width: "1.5rem", height: "1.5rem", color: "#fd1384" }} />
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--app-body-text)" }}>Agendar una llamada</h1>
      </div>
      <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", marginBottom: "2rem" }}>
        Agenda directamente con nuestro equipo. Elige un contacto y reserva en su calendario.
      </p>

      <Section
        title="Gestión de proyectos"
        description="Para temas relacionados con proyectos y tareas."
        people={managers}
        category="PROYECTOS"
      />

      {supportAvailable ? (
        <Section
          title="Soporte"
          description="Para temas relacionados con tickets y soporte."
          people={agents}
          category="SOPORTE"
        />
      ) : (
        <section style={{ marginBottom: "2.5rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--app-body-text)", marginBottom: "0.25rem" }}>Soporte</h2>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              backgroundColor: "var(--app-card-bg)",
              border: "1px solid var(--app-border)",
              borderRadius: "0.75rem",
              padding: "1.25rem",
            }}
          >
            <Lock style={{ width: "1.125rem", height: "1.125rem", color: "var(--app-text-muted)", flexShrink: 0, marginTop: "0.125rem" }} />
            <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", margin: 0, lineHeight: 1.5 }}>
              El agendamiento de soporte está disponible con un <strong>paquete activo</strong>. Contacta a tu agente para activar un plan de soporte o bolsa de horas.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}
