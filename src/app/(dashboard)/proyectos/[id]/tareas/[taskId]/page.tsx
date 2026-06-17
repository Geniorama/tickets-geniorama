import { notFound, redirect } from "next/navigation";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { TaskDetail } from "@/components/projects/task-detail";
import { BackButton } from "@/components/ui/back-button";
import { TaskChecklistPanel } from "@/components/ui/checklist-panel";
import { ProjectVaultPanel } from "@/components/vault/project-vault-panel";
import { ProjectAttachmentsPanel } from "@/components/projects/project-attachments-panel";

export async function generateMetadata({ params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { taskId } = await params;
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { title: true } });
  return { title: task?.title ?? "Tarea" };
}

export default async function TaskPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  const { id: projectId, taskId } = await params;
  const session = await getRequiredSession();
  const { id: userId, role } = session.user;
  const staff = isStaff(role);
  const admin = isAdmin(role);

  if (!staff && !admin) redirect(`/proyectos/${projectId}`);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, name: true, companyId: true } },
      assignedTo: { select: { id: true, name: true } },
      reviewers: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      comments: {
        include: {
          author: { select: { name: true } },
          reactions: { select: { type: true, userId: true } },
          attachments: { select: { type: true, url: true, name: true }, orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      checklistItems: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      attachments: {
        include: { uploadedBy: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      timeEntries: {
        include: { user: { select: { name: true } } },
        orderBy: { startedAt: "asc" },
      },
    },
  });

  if (!task || task.projectId !== projectId) notFound();

  // Los borradores son privados: solo su creador puede verlos
  if (task.isDraft && task.createdById !== userId) notFound();

  const moveableProjects = admin
    ? await prisma.project.findMany({
        where: { id: { not: projectId }, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  // Access control
  if (admin) {
    // always allowed
  } else if (staff) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { managerId: true },
    });
    const hasAccess =
      project?.managerId === userId || task.assignedToId === userId;
    if (!hasAccess) notFound();
  } else {
    // CLIENTE: must belong to project's company
    const project = task.project;
    if (!project || !project.companyId) notFound();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companies: { select: { id: true } } },
    });
    const companyIds = (user?.companies ?? []).map((c) => c.id);
    if (!companyIds.includes(project.companyId)) notFound();
  }

  // Configuración general del proyecto (accesos + adjuntos), visible también aquí
  // La Bóveda es visible solo para el creador y los usuarios con los que se comparte
  const vaultVisibility = { OR: [{ createdById: userId }, { sharedWith: { some: { userId } } }] };

  const [projectAttachments, linkedVaultEntries, availableVaultEntries] = await Promise.all([
    prisma.projectAttachment.findMany({
      where: { projectId },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { position: "asc" },
    }),
    prisma.vaultEntry.findMany({
      where: { projects: { some: { projectId } }, ...vaultVisibility },
      select: { id: true, title: true, username: true, url: true },
      orderBy: { title: "asc" },
    }),
    prisma.vaultEntry.findMany({
      where: { projects: { none: { projectId } }, ...vaultVisibility },
      select: { id: true, title: true, username: true, url: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const canManageProject = staff || admin;

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback={`/proyectos/${projectId}`} />
      </div>
      <TaskDetail
        task={task}
        session={session}
        projects={moveableProjects}
        checklistSlot={
          <TaskChecklistPanel
            key="checklist"
            taskId={taskId}
            projectId={projectId}
            initialItems={task.checklistItems}
            canDelete={admin}
          />
        }
      />

      {/* Configuración general del proyecto — siempre visible en el detalle de la tarea */}
      <div style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
          Configuración del proyecto: {task.project?.name}
        </h2>
        {(linkedVaultEntries.length > 0 || canManageProject) && (
          <ProjectVaultPanel
            projectId={projectId}
            linkedEntries={linkedVaultEntries}
            availableEntries={availableVaultEntries}
            canManage={canManageProject}
          />
        )}
        <ProjectAttachmentsPanel
          projectId={projectId}
          attachments={projectAttachments}
          canManage={canManageProject}
        />
      </div>
    </div>
  );
}
