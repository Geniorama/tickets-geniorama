import { notFound, redirect } from "next/navigation";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { canClientAccessTask } from "@/lib/task-access";
import { prisma } from "@/lib/prisma";
import { TaskDetail } from "@/components/projects/task-detail";
import { BackButton } from "@/components/ui/back-button";
import { TaskChecklistPanel } from "@/components/ui/checklist-panel";
import { ProjectVaultPanel } from "@/components/vault/project-vault-panel";
import { ProjectAttachmentsPanel } from "@/components/projects/project-attachments-panel";
import { listComments } from "@/lib/comments";
import { listAttachments } from "@/lib/attachments";
import { listChecklists } from "@/lib/checklists";

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
  const client = !staff && !admin;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, name: true, companyId: true, isPrivate: true } },
      assignedTo: { select: { id: true, name: true } },
      reviewers: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
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
    // CLIENTE: solo si el staff lo involucró — mencionado en un comentario o
    // revisor de la tarea — y la tarea es de un proyecto de su empresa.
    const hasAccess = await canClientAccessTask(taskId, userId);
    if (!hasAccess) redirect(`/proyectos/${projectId}`);
  }

  // Comentarios y adjuntos viven en tablas compartidas; se cargan una vez
  // superado el control de acceso de arriba.
  const [comments, attachments, checklists] = await Promise.all([
    listComments({ entityType: "TASK", entityId: taskId, includeInternal: true }),
    listAttachments("TASK", taskId),
    listChecklists({ entityType: "TASK", entityId: taskId }),
  ]);

  // Configuración general del proyecto (accesos + adjuntos), visible también aquí.
  // La Bóveda es visible solo para el creador y los usuarios con los que se comparte.
  // Los clientes no ven esta sección: su acceso es a la tarea, no al proyecto.
  const vaultVisibility = { OR: [{ createdById: userId }, { sharedWith: { some: { userId } } }] };

  const [projectAttachments, linkedVaultEntries, availableVaultEntries] = client
    ? [[], [], []]
    : await Promise.all([
        listAttachments("PROJECT", projectId),
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
        {/* Un cliente con acceso a la tarea de un proyecto privado no puede
            abrir el proyecto: se le devuelve al listado */}
        <BackButton
          fallback={
            client && task.project?.isPrivate ? "/proyectos" : `/proyectos/${projectId}`
          }
        />
      </div>
      <TaskDetail
        task={{ ...task, comments, attachments }}
        session={session}
        projects={moveableProjects}
        canOpenProject={!client || !task.project?.isPrivate}
        checklistSlot={
          <TaskChecklistPanel
            key="checklist"
            taskId={taskId}
            projectId={projectId}
            initialChecklists={checklists}
            canDelete={admin}
            readOnly={client}
          />
        }
      />

      {/* Configuración general del proyecto — interna, oculta para clientes */}
      {!client && (
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
      )}
    </div>
  );
}
