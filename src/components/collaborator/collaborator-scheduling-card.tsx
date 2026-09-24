import { CalendarClock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SchedulingCard } from "./scheduling-card";
import type { SchedulingLinkData, SchedulingCategory } from "@/lib/scheduling";

// Tarjeta de agendamiento embebida en el detalle de proyecto (gestor) o de ticket
// (agente). Consulta al usuario y solo se muestra si está activo, tiene la designación
// correspondiente y algo que ofrecer (bio o links). Si no, no renderiza nada.
export async function CollaboratorSchedulingCard({
  userId,
  category,
  heading,
}: {
  userId: string | null | undefined;
  category: SchedulingCategory;
  heading: string;
}) {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      cargo: true,
      bio: true,
      avatarUrl: true,
      isActive: true,
      isProjectManager: true,
      isSupportAgent: true,
      schedulingLinks: {
        where: { category },
        select: { id: true, title: true, description: true, url: true, category: true },
        orderBy: { position: "asc" },
      },
    },
  });

  if (!user || !user.isActive) return null;

  const designated = category === "PROYECTOS" ? user.isProjectManager : user.isSupportAgent;
  if (!designated) return null;

  // No mostrar una tarjeta vacía
  if (!user.bio && user.schedulingLinks.length === 0) return null;

  // Una tarjeta más de la ficha: mismo marco y cabecera que las demás, para que
  // no parezca un bloque suelto al pie de la página.
  return (
    <section
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        padding: "1.25rem 1.5rem",
      }}
    >
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          fontSize: "0.9375rem",
          fontWeight: 600,
          color: "var(--app-body-text)",
          margin: "0 0 1rem",
        }}
      >
        <CalendarClock style={{ width: "1rem", height: "1rem", color: "#fd1384", flexShrink: 0 }} />
        {heading}
      </h2>
      <SchedulingCard
        name={user.name}
        cargo={user.cargo}
        bio={user.bio}
        avatarUrl={user.avatarUrl}
        links={user.schedulingLinks as SchedulingLinkData[]}
        compact
        bare
      />
    </section>
  );
}
