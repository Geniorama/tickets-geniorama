/**
 * Avisos por mención (`@[Nombre](userId)`) en un comentario.
 *
 * Vive aquí y no en cada sitio que comenta para que la web, la API y el MCP
 * avisen igual: cuando estaba copiado en las acciones de la web, lo que entraba
 * por la API no avisaba a nadie de que lo habían mencionado.
 *
 * Quien es mencionado recibe la notificación de siempre (campana, push, su
 * webhook y Google Chat) y además un correo, sea cliente o del equipo: una
 * mención es alguien pidiendo tu atención, y la campana sola se pierde.
 */

import { prisma } from "@/lib/prisma";
import { extractMentionIds } from "@/lib/comments";
import { notifyMany } from "@/lib/notify";
import { sendMentionEmail } from "@/lib/email";
import { can } from "@/lib/access/can";

export async function notifyMentions(input: {
  author: { id: string; name?: string | null };
  entityType: "TASK" | "TICKET" | "BILLING";
  entityId: string;
  body: string;
}): Promise<void> {
  let mentionedIds = extractMentionIds(input.body).filter((id) => id !== input.author.id);
  if (mentionedIds.length === 0) return;

  // La facturación es interna: avisar a alguien sin acceso al módulo le
  // mostraría el concepto y la empresa de un cobro que no puede abrir.
  if (input.entityType === "BILLING") {
    const users = await prisma.user.findMany({
      where: { id: { in: mentionedIds }, isActive: true },
      select: { id: true, role: true },
    });
    const permitidos: string[] = [];
    for (const u of users) {
      if (await can(u, "FACTURACION", "ver")) permitidos.push(u.id);
    }
    mentionedIds = permitidos;
    if (mentionedIds.length === 0) return;
  }

  const authorName = input.author.name ?? "Alguien";
  let title = "";
  let path: string;
  let skipGChat = false;
  let contextLabel: string;
  let where: string;

  if (input.entityType === "TASK") {
    const task = await prisma.task.findUnique({
      where: { id: input.entityId },
      select: { title: true, project: { select: { id: true, isPrivate: true } } },
    });
    title = task?.title ?? "";
    path = task?.project ? `/proyectos/${task.project.id}/tareas/${input.entityId}` : `/tareas/${input.entityId}`;
    skipGChat = task?.project?.isPrivate ?? false;
    contextLabel = "una tarea";
    where = "En la tarea";
  } else if (input.entityType === "BILLING") {
    const cobro = await prisma.billingItem.findUnique({
      where: { id: input.entityId },
      select: { concept: true, company: { select: { name: true } } },
    });
    title = cobro ? `${cobro.concept} · ${cobro.company.name}` : "";
    path = `/facturacion/${input.entityId}`;
    // Los cobros son dinero ajeno: no se publican en el chat del equipo.
    skipGChat = true;
    contextLabel = "un cobro";
    where = "En el cobro";
  } else {
    const ticket = await prisma.ticket.findUnique({ where: { id: input.entityId }, select: { title: true } });
    title = ticket?.title ?? "";
    path = `/tickets/${input.entityId}`;
    contextLabel = "un ticket";
    where = "En el ticket";
  }

  await notifyMany(mentionedIds, "mention", `${authorName} te mencionó`, `${where}: "${title}"`, path, skipGChat);

  const appUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const mentionedUsers = await prisma.user.findMany({
    where: { id: { in: mentionedIds }, isActive: true },
    select: { name: true, email: true },
  });
  for (const mentioned of mentionedUsers) {
    void sendMentionEmail(
      { name: mentioned.name, email: mentioned.email },
      authorName,
      contextLabel,
      title,
      `${appUrl}${path}`,
    ).catch(console.error);
  }
}
