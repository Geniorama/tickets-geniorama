import { requireCan } from "@/lib/access/can";
import { operationalCompanyWhere } from "@/lib/crm/accounts";
import { prisma } from "@/lib/prisma";
import { ProjectForm } from "@/components/projects/project-form";
import { PlannerLauncher } from "@/components/assistant/planner-tool";
import { isAdmin } from "@/lib/roles";

export const metadata = { title: "Nuevo proyecto" };

export default async function NewProjectPage() {
  const session = await requireCan("PROYECTOS", "gestionar");
  // El planificador solo crea proyectos para administradores (ver applyPlan)
  const admin = isAdmin(session.user.role);

  const [companies, staffUsers, allUsers] = await Promise.all([
    prisma.company.findMany({
      where: operationalCompanyWhere,
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  return (
    <div style={{ padding: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
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
        {admin && <PlannerLauncher isAdmin newOnly label="Crear con IA desde un documento" />}
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
        <ProjectForm companies={companies} staffUsers={staffUsers} allUsers={allUsers} />
      </div>
    </div>
  );
}
