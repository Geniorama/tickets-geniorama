import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "@/components/projects/project-form";
import { BackButton } from "@/components/ui/back-button";

export const metadata = { title: "Editar proyecto — Geniorama Tickets" };

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMINISTRADOR"]);
  const { id: projectId } = await params;

  const [project, companies, staffUsers] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.company.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!project) notFound();

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback={`/proyectos/${projectId}`} />
      </div>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "var(--app-body-text)",
          marginBottom: "1.5rem",
        }}
      >
        Editar proyecto
      </h1>

      <div
        style={{
          maxWidth: "42rem",
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <ProjectForm companies={companies} staffUsers={staffUsers} project={project} />
      </div>
    </div>
  );
}
