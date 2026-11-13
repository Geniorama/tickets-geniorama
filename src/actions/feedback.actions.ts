"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { can } from "@/lib/access/can";
import { uploadFeedbackScreenshot } from "@/lib/s3";
import { sendGChatNotification } from "@/lib/gchat";
import { emitTaskHook } from "@/lib/hooks/dispatch";
import { nextTaskNumber } from "@/lib/task-number";
import {
  FEEDBACK_MAX_MESSAGE,
  FEEDBACK_MAX_SCREENSHOT_BYTES,
  FEEDBACK_SCREENSHOT_TYPES,
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPES,
  isFeedbackStatus,
} from "@/lib/feedback";

const submitSchema = z.object({
  type: z.enum(FEEDBACK_TYPES, { message: "Elige el tipo de feedback" }),
  message: z
    .string()
    .trim()
    .min(5, "Cuéntanos un poco más (mínimo 5 caracteres)")
    .max(FEEDBACK_MAX_MESSAGE, `El mensaje no puede pasar de ${FEEDBACK_MAX_MESSAGE} caracteres`),
});

/** El texto de un campo del navegador, recortado: nunca se confía en su tamaño. */
function ctx(formData: FormData, key: string, max: number): string | null {
  const v = formData.get(key);
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

/**
 * Cualquier usuario autenticado —cliente, colaborador o administrador— puede
 * dejar feedback. El contexto lo pone el servidor (quién, rol, empresa) o lo
 * manda el navegador (pantalla, navegador), y se congela en el registro.
 */
export async function submitFeedback(formData: FormData) {
  const session = await getRequiredSession();

  const parsed = submitSchema.safeParse({
    type: formData.get("type"),
    message: formData.get("message"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const screenshot = formData.get("screenshot");
  const file = screenshot instanceof File && screenshot.size > 0 ? screenshot : null;
  if (file) {
    if (!FEEDBACK_SCREENSHOT_TYPES.includes(file.type)) {
      return { error: "La captura debe ser una imagen (PNG, JPG, WebP o GIF)" };
    }
    if (file.size > FEEDBACK_MAX_SCREENSHOT_BYTES) {
      return { error: "La captura no puede pasar de 5 MB" };
    }
  }

  // La empresa sale de la base, no del formulario: un usuario no elige desde
  // qué empresa escribe.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, role: true, companies: { select: { id: true, name: true }, take: 1, orderBy: { name: "asc" } } },
  });
  if (!user) return { error: "No se pudo identificar tu cuenta" };
  const company = user.companies[0] ?? null;

  const feedback = await prisma.feedback.create({
    data: {
      type: parsed.data.type,
      message: parsed.data.message,
      userId: session.user.id,
      userName: user.name,
      userEmail: user.email,
      userRole: user.role,
      companyId: company?.id ?? null,
      companyName: company?.name ?? null,
      pageUrl: ctx(formData, "pageUrl", 500),
      userAgent: ctx(formData, "userAgent", 500),
      viewport: ctx(formData, "viewport", 40),
    },
  });

  // La captura es un complemento: si falla la subida, el feedback ya está
  // guardado y no se pierde por eso.
  let screenshotFailed = false;
  if (file) {
    try {
      const { storagePath, fileUrl } = await uploadFeedbackScreenshot(file, feedback.id);
      await prisma.feedback.update({
        where: { id: feedback.id },
        data: { screenshotPath: storagePath, screenshotUrl: fileUrl },
      });
    } catch (err) {
      console.error("[feedback] No se pudo subir la captura:", err);
      screenshotFailed = true;
    }
  }

  await sendGChatNotification(
    "ticket_new",
    "Nuevo feedback",
    `${user.name}${company ? ` (${company.name})` : ""} · ${FEEDBACK_TYPE_LABELS[parsed.data.type]}: ${parsed.data.message.slice(0, 200)}`,
    "/admin/feedback",
  ).catch(() => {});

  revalidatePath("/admin/feedback");
  return { success: true as const, screenshotFailed };
}

/** Quien gestiona Administración lee y resuelve el buzón. */
async function requireGestor() {
  const session = await getRequiredSession();
  if (!(await can(session.user, "ADMIN", "gestionar"))) return null;
  return session;
}

export async function setFeedbackStatus(feedbackId: string, status: string) {
  const session = await requireGestor();
  if (!session) return { error: "Sin permisos" };
  if (!isFeedbackStatus(status) || status === "CONVERTIDO") {
    // «Convertido» solo se alcanza convirtiendo: así siempre hay una tarea detrás.
    return { error: "Estado no válido" };
  }
  const current = await prisma.feedback.findUnique({ where: { id: feedbackId }, select: { status: true, taskId: true } });
  if (!current) return { error: "Feedback no encontrado" };
  if (current.status === "CONVERTIDO") {
    return { error: `Ya está ${FEEDBACK_STATUS_LABELS.CONVERTIDO.toLowerCase()}: su estado no cambia` };
  }

  await prisma.feedback.update({ where: { id: feedbackId }, data: { status } });
  revalidatePath("/admin/feedback");
  return { success: true as const };
}

/**
 * Crea la tarea en el proyecto elegido con el feedback enlazado, y lo marca
 * «Convertido». La tarea nace con todo el contexto en la descripción, para
 * trabajarla sin volver al buzón.
 */
export async function convertFeedbackToTask(feedbackId: string, projectId: string) {
  const session = await requireGestor();
  if (!session) return { error: "Sin permisos" };

  const fb = await prisma.feedback.findUnique({ where: { id: feedbackId } });
  if (!fb) return { error: "Feedback no encontrado" };
  if (fb.taskId) return { error: "Este feedback ya se convirtió en tarea" };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, isActive: true, isDraft: true, isPrivate: true },
  });
  if (!project) return { error: "El proyecto no existe" };
  if (!project.isActive) return { error: "El proyecto está inactivo" };
  if (project.isDraft) return { error: "El proyecto es un borrador: publícalo antes" };

  const appUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const lines = [
    `## Feedback de ${fb.userName}`,
    "",
    fb.message,
    "",
    "## Contexto",
    `- Tipo: ${FEEDBACK_TYPE_LABELS[fb.type]}`,
    `- Usuario: ${fb.userName} (${fb.userEmail}) · ${fb.userRole}`,
    ...(fb.companyName ? [`- Empresa: ${fb.companyName}`] : []),
    ...(fb.pageUrl ? [`- Pantalla: ${fb.pageUrl}`] : []),
    ...(fb.userAgent ? [`- Navegador: ${fb.userAgent}`] : []),
    ...(fb.viewport ? [`- Ventana: ${fb.viewport}`] : []),
    `- Enviado: ${fb.createdAt.toISOString()}`,
    ...(fb.screenshotUrl ? [`- Captura: ${fb.screenshotUrl}`] : []),
    "",
    `_Origen: buzón de feedback — ${appUrl}/admin/feedback_`,
  ];

  const title = `Feedback: ${fb.message.replace(/\s+/g, " ").slice(0, 120)}`;

  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        number: await nextTaskNumber(tx, project.id),
        title,
        description: lines.join("\n"),
        priority: fb.type === "ERROR" ? "ALTA" : "MEDIA",
        category: "Feedback",
        projectId: project.id,
        createdById: session.user.id,
      },
    });
    await tx.feedback.update({
      where: { id: fb.id },
      data: { taskId: created.id, status: "CONVERTIDO" },
    });
    return created;
  });

  emitTaskHook("task.created", task.id, {
    actor: session.user,
    projectId: project.id,
    projectIsPrivate: project.isPrivate,
  });

  revalidatePath("/admin/feedback");
  revalidatePath(`/proyectos/${project.id}`);
  return { success: true as const, taskUrl: `/proyectos/${project.id}/tareas/${task.id}` };
}
