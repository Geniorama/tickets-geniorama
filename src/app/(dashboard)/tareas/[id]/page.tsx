import { notFound, redirect } from "next/navigation";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { TaskDetail } from "@/components/projects/task-detail";
import { BackButton } from "@/components/ui/back-button";
import { TaskChecklistPanel } from "@/components/ui/checklist-panel";
import { listComments } from "@/lib/comments";
import { listAttachments } from "@/lib/attachments";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id }, select: { title: true } });
  return { title: task?.title ?? "Tarea" };
}

export default async function GlobalTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: taskId } = await params;
  const session = await getRequiredSession();
  const { role } = session.user;
  const staff = isStaff(role);
  const admin = isAdmin(role);

  // Los clientes no tienen lista global de tareas, pero sí pueden llegar aquí
  // desde un enlace: se resuelve más abajo redirigiendo al detalle del proyecto,
  // que es donde se evalúa su acceso (mención o revisor).
  const client = !staff && !admin;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      reviewers: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      checklists: {
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        include: { items: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } },
      },
      timeEntries: {
        include: { user: { select: { name: true } } },
        orderBy: { startedAt: "asc" },
      },
    },
  });

  if (!task) notFound();

  // Los borradores son privados: solo su creador puede verlos
  if (task.isDraft && task.createdById !== session.user.id) notFound();

  if (task.projectId) {
    redirect(`/proyectos/${task.projectId}/tareas/${taskId}`);
  }

  // Tarea global (sin proyecto): no hay empresa que valide el acceso del cliente
  if (client) redirect("/dashboard");

  // Comentarios y adjuntos viven en tablas compartidas, fuera de la relación.
  const [comments, attachments] = await Promise.all([
    listComments({ entityType: "TASK", entityId: taskId, includeInternal: true }),
    listAttachments("TASK", taskId),
  ]);

  const moveableProjects = admin
    ? await prisma.project.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback="/tareas" />
      </div>
      <TaskDetail
        task={{ ...task, comments, attachments }}
        session={session}
        projects={moveableProjects}
        checklistSlot={
          <TaskChecklistPanel
            key="checklist"
            taskId={taskId}
            projectId={null}
            initialChecklists={task.checklists}
            canDelete={admin}
          />
        }
      />
    </div>
  );
}
