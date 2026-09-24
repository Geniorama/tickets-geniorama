"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import {
  type AiProvider,
  DEFAULT_AI_PROVIDER,
  resolveProvider,
  providerConfigError,
  runTextCompletion,
  runImageGeneration,
} from "@/lib/ai";
import { listComments } from "@/lib/comments";
import { addFileAttachments } from "@/lib/attachments";
import { isDesignTask, SKETCH_FORMATS, MAX_SKETCHES, type SketchFormatId } from "@/lib/design-tasks";

// Herramientas de IA para tareas de diseño: el brief creativo y los bocetos.
// Solo para el equipo, y solo en tareas cuya categoría es de diseño.

/** Lo que la IA necesita saber de la tarea, en un bloque de texto. */
async function loadDesignTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      dueDate: true,
      projectId: true,
      project: { select: { name: true, company: { select: { name: true } } } },
    },
  });
  if (!task) return { error: "Tarea no encontrada" } as const;
  if (!isDesignTask(task.category)) {
    return { error: "Estas herramientas son para tareas de diseño (Redes Sociales, Diseño Gráfico, Branding…)." } as const;
  }

  // Del hilo salen las decisiones que no están en la descripción: cambios del
  // cliente, referencias, lo que ya se descartó.
  const comments = (await listComments({ entityType: "TASK", entityId: taskId, includeInternal: true })).slice(-30);

  let ctx = `**Tarea:** ${task.title}
**Categoría:** ${task.category}${task.project ? `\n**Proyecto:** ${task.project.name}` : ""}${task.project?.company ? `\n**Cliente / marca:** ${task.project.company.name}` : ""}${task.dueDate ? `\n**Fecha de entrega:** ${task.dueDate.toLocaleDateString("es-CO")}` : ""}

**Descripción:**
${task.description || "(sin descripción)"}`;

  if (comments.length > 0) {
    ctx += `\n\n**Comentarios de la tarea (del más antiguo al más reciente):**`;
    for (const c of comments) ctx += `\n- ${c.author.name}: ${c.body}`;
  }

  return { task, ctx } as const;
}

function revalidateTask(taskId: string, projectId: string | null) {
  if (projectId) revalidatePath(`/proyectos/${projectId}/tareas/${taskId}`);
  revalidatePath(`/tareas/${taskId}`);
}

// ─── Brief creativo ───────────────────────────────────────────────────────────

export async function generateDesignBrief(
  taskId: string,
  provider: AiProvider = DEFAULT_AI_PROVIDER,
): Promise<{ error?: string; brief?: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };
  provider = resolveProvider(provider);
  const cfgErr = providerConfigError(provider);
  if (cfgErr) return { error: cfgErr };

  const loaded = await loadDesignTask(taskId);
  if ("error" in loaded) return { error: loaded.error };

  const prompt = `Eres director/a creativo/a en la agencia Geniorama. A partir de la tarea de abajo, escribe un brief creativo para el diseñador que va a producir la pieza.

Estructura el brief así, en markdown y en español:
1. **Objetivo** — qué debe lograr la pieza, en una o dos frases.
2. **Público** — a quién le habla y qué le importa.
3. **Formato y medidas** — red o medio, y medidas de exportación (p. ej. feed 1080×1080 o 1080×1350, historias y reels 1080×1920). Si la tarea no lo dice, propón el más adecuado y márcalo como sugerencia.
4. **Mensaje y copy** — el mensaje central y 3 opciones de copy, cada una con titular corto (máx. 8 palabras), texto de apoyo y CTA. Añade hashtags si aplica.
5. **Dirección visual** — estilo, composición, jerarquía, paleta sugerida y tipo de imagen (foto, ilustración, 3D…).
6. **Qué evitar** — errores comunes para esta pieza.
7. **Checklist de entrega** — lo que el diseñador debe verificar antes de enviarla.

Sé concreto y accionable: nada de frases genéricas. No inventes datos del cliente (precios, fechas, promociones) que no estén en la tarea; si faltan, indícalo como pregunta pendiente al final.

---
${loaded.ctx}`;

  try {
    const brief = await runTextCompletion({ provider, prompt });
    if (!brief.trim()) return { error: "La IA no devolvió ningún brief. Intenta de nuevo." };
    return { brief };
  } catch (err) {
    console.error("[generateDesignBrief]", err);
    return { error: "Error al generar el brief con IA." };
  }
}

// ─── Bocetos ──────────────────────────────────────────────────────────────────

export async function generateDesignSketches(
  taskId: string,
  input: { format: SketchFormatId; count: number; instructions?: string; brief?: string },
): Promise<{ error?: string; images?: { name: string; url: string }[]; saveErrors?: string[] }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  // Los bocetos son siempre con OpenAI: es el proveedor principal y el que
  // tiene la generación de imagen integrada.
  const cfgErr = providerConfigError("openai");
  if (cfgErr) return { error: cfgErr };

  const format = SKETCH_FORMATS.find((f) => f.id === input.format);
  if (!format) return { error: "Formato no válido" };
  const count = Math.min(MAX_SKETCHES, Math.max(1, Math.floor(input.count) || 1));

  const loaded = await loadDesignTask(taskId);
  if ("error" in loaded) return { error: loaded.error };

  const instructions = input.instructions?.trim().slice(0, 1500);
  // El brief puede ser largo; lo esencial está al principio (objetivo, copy)
  const brief = input.brief?.trim().slice(0, 4000);

  const prompt = `Boceto de una pieza gráfica para ${format.hint.toLowerCase()} (formato ${format.label.toLowerCase()}), como propuesta visual para que un diseñador la desarrolle.

${brief ? `BRIEF CREATIVO:\n${brief}\n\n` : ""}DATOS DE LA TAREA:
${loaded.ctx}
${instructions ? `\nINDICACIONES DEL EQUIPO (prioritarias):\n${instructions}\n` : ""}
Reglas del boceto:
- Composición clara con una jerarquía visual evidente y espacio para el texto.
- Como mucho un titular corto y legible; nada de párrafos ni letra pequeña.
- Sin logotipos inventados ni marcas de terceros.
- Acabado profesional, apto para redes sociales.`;

  let buffers: Buffer[];
  try {
    buffers = await runImageGeneration({ prompt, size: format.size, n: count });
  } catch (err) {
    console.error("[generateDesignSketches]", err);
    const msg = err instanceof Error ? err.message : "";
    if (/organization must be verified|verify/i.test(msg)) {
      return { error: "La cuenta de OpenAI no tiene acceso al modelo de imagen (requiere verificar la organización en OpenAI)." };
    }
    if (/safety|moderation|rejected/i.test(msg)) {
      return { error: "OpenAI rechazó el pedido por sus políticas de contenido. Ajusta las indicaciones e intenta de nuevo." };
    }
    return { error: "Error al generar los bocetos con IA." };
  }
  if (buffers.length === 0) return { error: "La IA no devolvió imágenes. Intenta de nuevo." };

  // Se guardan como adjuntos de la tarea: quedan con el resto de la ficha y
  // se ven en la pestaña Adjuntos.
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const files = buffers.map(
    (buf, i) =>
      new File([new Uint8Array(buf)], `boceto-ia-${format.id}-${stamp}-${i + 1}.png`, { type: "image/png" }),
  );
  const { errors } = await addFileAttachments({
    entityType: "TASK",
    entityId: taskId,
    storageKey: taskId,
    files,
    uploadedById: session.user.id,
  });

  const saved = await prisma.attachment.findMany({
    where: { entityType: "TASK", entityId: taskId, fileName: { in: files.map((f) => f.name) } },
    select: { fileName: true, fileUrl: true },
    orderBy: { position: "asc" },
  });

  revalidateTask(taskId, loaded.task.projectId);

  if (saved.length === 0) return { error: `No se pudieron guardar los bocetos: ${errors.join("; ")}` };
  return {
    images: saved.map((a) => ({ name: a.fileName, url: a.fileUrl })),
    saveErrors: errors.length ? errors : undefined,
  };
}
