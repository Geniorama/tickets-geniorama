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

  return (
    <div style={{ maxWidth: "24rem" }}>
      <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", marginBottom: "0.5rem" }}>
        {heading}
      </p>
      <SchedulingCard
        name={user.name}
        cargo={user.cargo}
        bio={user.bio}
        avatarUrl={user.avatarUrl}
        links={user.schedulingLinks as SchedulingLinkData[]}
        compact
      />
    </div>
  );
}
