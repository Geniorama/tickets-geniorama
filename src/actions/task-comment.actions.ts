"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { validateFile } from "@/lib/s3";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;

async function uploadCommentFile(
  file: File,
  taskId: string
): Promise<{ storagePath: string; fileUrl: string }> {
  const ext = file.name.split(".").pop();
  const storagePath = `tasks/${taskId}/comments/${crypto.randomUUID()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storagePath,
      Body: Buffer.from(arrayBuffer),
      ContentType: file.type,
    })
  );

  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, "");
  let fileUrl: string;
  if (publicUrl) {
    fileUrl = `${publicUrl}/${storagePath}`;
  } else {
    fileUrl = await getSignedUrl(
      r2,
      new GetObjectCommand({ Bucket: BUCKET, Key: storagePath }),
      { expiresIn: 60 * 60 * 24 * 7 }
    );
  }

  return { storagePath, fileUrl };
}

const commentSchema = z.object({
  body: z.string().min(1, "El comentario no puede estar vacío"),
});

export async function addTaskComment(
  taskId: string,
  projectId: string,
  formData: FormData
) {
  const session = await getRequiredSession();

  const parsed = commentSchema.safeParse({ body: formData.get("body") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const attachmentType = formData.get("attachmentType")?.toString() || null;
  let attachmentUrl: string | null = null;
  let attachmentName: string | null = null;
  let attachmentStoragePath: string | null = null;

  if (attachmentType === "link") {
    const url = formData.get("linkUrl")?.toString().trim() ?? "";
    const label = formData.get("linkLabel")?.toString().trim() || null;
    if (!url) return { error: "La URL del enlace es requerida" };
    try {
      new URL(url);
    } catch {
      return { error: "La URL no es válida" };
    }
    attachmentUrl = url;
    attachmentName = label ?? url;
  }

  if (attachmentType === "file") {
    const file = formData.get("attachmentFile");
    if (!(file instanceof File) || file.size === 0)
      return { error: "No se seleccionó ningún archivo" };
    const validationError = validateFile(file);
    if (validationError) return { error: validationError };
    try {
      const { storagePath, fileUrl } = await uploadCommentFile(file, taskId);
      attachmentUrl = fileUrl;
      attachmentName = file.name;
      attachmentStoragePath = storagePath;
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Error al subir archivo",
      };
    }
  }

  await prisma.taskComment.create({
    data: {
      taskId,
      authorId: session.user.id,
      body: parsed.data.body,
      attachmentType,
      attachmentUrl,
      attachmentName,
      attachmentStoragePath,
    },
  });

  revalidatePath(`/proyectos/${projectId}/tareas/${taskId}`);
  return { success: true };
}

export async function deleteTaskComment(
  commentId: string,
  taskId: string,
  projectId: string
) {
  const session = await getRequiredSession();

  const comment = await prisma.taskComment.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  });

  if (!comment) return { error: "Comentario no encontrado" };

  const isAdmin = session.user.role === "ADMINISTRADOR";
  if (!isAdmin && comment.authorId !== session.user.id)
    return { error: "Sin permisos" };

  await prisma.taskComment.delete({ where: { id: commentId } });
  revalidatePath(`/proyectos/${projectId}/tareas/${taskId}`);
  return { success: true };
}
