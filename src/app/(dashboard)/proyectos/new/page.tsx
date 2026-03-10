import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "@/components/projects/project-form";

export const metadata = { title: "Nuevo proyecto — Geniorama Tickets" };

export default async function NewProjectPage() {
  await requireRole(["ADMINISTRADOR"]);

  const [companies, staffUsers] = await Promise.all([
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

  return (
    <div style={{ padding: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            color: "var(--app-body-text)",
          }}
        >
          Nuevo proyecto
        </h1>
      </div>

      <div
        style={{
          maxWidth: "42rem",
          backgroundColor: "var(--app-card-bg)",
          border: "1px solid var(--app-border)",
          borderRadius: "0.75rem",
          padding: "1.5rem",
        }}
      >
        <ProjectForm companies={companies} staffUsers={staffUsers} />
      </div>
    </div>
  );
}
