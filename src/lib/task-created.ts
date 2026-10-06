/**
 * Avisos, webhooks y hooks de una tarea recién creada.
 *
 * Vivía dentro de la Server Action del formulario, y la API —por donde entra
 * el asistente (MCP)— tenía una copia sin el aviso a Google Chat. Está aquí
 * para que crear una tarea avise igual se cree desde donde se cree.
 */

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import { sendGChatNotification } from "@/lib/gchat";
import { emitTaskHook } from "@/lib/hooks/dispatch";

export async function notifyTaskCreated(
  task: { id: string; title: string; assignedToId: string | null; dueDate: Date | null },
  projectId: string,
  isDraft: boolean,
  actor: { id: string; name?: string | null },
) {
  const [project, assignee] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { name: true, isPrivate: true, isDraft: true } }),
    task.assignedToId
      ? prisma.user.findUnique({ where: { id: task.assignedToId }, select: { name: true } })
      : null,
  ]);

  const projectIsPrivate = project?.isPrivate ?? false;
  const taskUrl = `/proyectos/${projectId}/tareas/${task.id}`;

  // Los borradores no notifican a nadie hasta que se publican. Tampoco una
  // tarea dentro de un proyecto en borrador: el proyecto aún no existe para
  // nadie más, y el aviso llevaría a una página que no pueden abrir.
  const silent = isDraft || !!project?.isDraft;
  if (!silent) {
    // Construir mensaje enriquecido para GChat
    const msgParts: string[] = [`"${task.title}"${project ? ` en ${project.name}` : ""}`];
    if (assignee?.name) msgParts.push(`Asignado a: ${assignee.name}`);
    if (task.dueDate) msgParts.push(`Vence: ${format(task.dueDate, "d MMM yyyy", { locale: es })}`);

    // Notificar creación de tarea al webhook (sin destinatario en-app)
    if (!projectIsPrivate) {
      await sendGChatNotification("task_new", "Nueva tarea", msgParts.join(" · "), taskUrl);
    }

    // Notificar al asignado si no es el creador
    if (task.assignedToId && task.assignedToId !== actor.id) {
      await notify(
        task.assignedToId,
        "task_assigned",
        "Tarea asignada",
        `Se te asignó: "${task.title}"${project ? ` en ${project.name}` : ""}`,
        taskUrl,
        true, // asignación individual: no va al webhook de equipo (GChat)
      );
    }
  }

  // Los borradores no salen de la plataforma hasta publicarse, igual que no
  // notifican a nadie.
  if (!isDraft) {
    emitTaskHook("task.created", task.id, {
      actor,
      projectId,
      projectIsPrivate,
    });
  }
}
