import { notFound, redirect } from "next/navigation";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { TaskDetail } from "@/components/projects/task-detail";
import { BackButton } from "@/components/ui/back-button";

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
      createdBy: { select: { id: true, name: true } },
      comments: {
        include: {
          author: { select: { name: true } },
          reactions: { select: { type: true, userId: true } },
        },
        orderBy: { createdAt: "asc" },
      },
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
    if (!project.companyId) notFound();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { companies: { select: { id: true } } },
    });
    const companyIds = (user?.companies ?? []).map((c) => c.id);
    if (!companyIds.includes(project.companyId)) notFound();
  }

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <BackButton fallback={`/proyectos/${projectId}`} />
      </div>
      <TaskDetail task={task} session={session} projects={moveableProjects} />
    </div>
  );
}
