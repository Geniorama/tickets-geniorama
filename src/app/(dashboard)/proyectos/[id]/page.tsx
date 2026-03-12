import { notFound } from "next/navigation";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { ProjectDetail } from "@/components/projects/project-detail";
import { BackButton } from "@/components/ui/back-button";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id: projectId } = await params;
  const session = await getRequiredSession();
  const { id: userId, role } = session.user;
  const sp = await searchParams;
  const staff = isStaff(role);
  const admin = isAdmin(role);

  const rawView = sp.view;
  const view =
    rawView === "kanban"
      ? "kanban"
      : rawView === "calendario"
      ? "calendario"
      : "lista";

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      company: { select: { id: true, name: true } },
      manager: { select: { name: true } },
      createdBy: { select: { name: true } },
      tasks: {
        include: {
          assignedTo: { select: { name: true } },
          createdBy: { select: { name: true } },
          project: { select: { id: true, name: true } },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      attachments: {
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) notFound();

  // Vault entries linked to this project, filtered by user visibility
  const linkedVaultEntries = await prisma.vaultEntry.findMany({
    where: {
      projects: { some: { projectId } },
      ...(admin ? {} : {
        OR: [
          { createdById: userId },
          { sharedWith: { some: { userId } } },
        ],
      }),
    },
    select: { id: true, title: true, username: true, url: true },
    orderBy: { title: "asc" },
  });

  // Available vault entries to link (only for staff/admin)
  const availableVaultEntries = (staff || admin)
    ? await prisma.vaultEntry.findMany({
        where: {
          projects: { none: { projectId } },
          ...(admin ? {} : {
            OR: [
              { createdById: userId },
              { sharedWith: { some: { userId } } },
            ],
          }),
        },
        select: { id: true, title: true, username: true, url: true },
        orderBy: { title: "asc" },
      })
    : [];

  // Access control
  if (admin) {
    // always allowed
  } else if (staff) {
    // Must be manager or have assigned tasks
    const hasAccess =
      project.managerId === userId ||
      project.tasks.some((t) => t.assignedToId === userId);
    if (!hasAccess) notFound();
  } else {
    // CLIENTE: must belong to project's company
    if (!project.companyId) notFound();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companies: { select: { id: true } } },
    });
    const companyIds = (user?.companies ?? []).map((c) => c.id);
    if (!companyIds.includes(project.companyId)) notFound();
  }

  return (
    <div style={{ padding: "1.5rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback="/proyectos" />
      </div>
      <ProjectDetail
        project={project}
        view={view as "lista" | "kanban" | "calendario"}
        isAdmin={admin}
        isStaff={staff}
        isClient={!staff && !admin}
        linkedVaultEntries={linkedVaultEntries}
        availableVaultEntries={availableVaultEntries}
      />
    </div>
  );
}
