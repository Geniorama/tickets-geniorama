import { notFound, redirect } from "next/navigation";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { TaskDetail } from "@/components/projects/task-detail";
import { BackButton } from "@/components/ui/back-button";
import { TaskChecklistPanel } from "@/components/ui/checklist-panel";

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

  if (!staff && !admin) redirect("/tareas");

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      comments: {
        include: {
          author: { select: { name: true } },
          reactions: { select: { type: true, userId: true } },
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

  if (!task) notFound();

  if (task.projectId) {
    redirect(`/proyectos/${task.projectId}/tareas/${taskId}`);
  }

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
        task={task}
        session={session}
        projects={moveableProjects}
        checklistSlot={
          <TaskChecklistPanel
            key="checklist"
            taskId={taskId}
            projectId={null}
            initialItems={task.checklistItems}
            canDelete={admin}
          />
        }
      />
    </div>
  );
}
