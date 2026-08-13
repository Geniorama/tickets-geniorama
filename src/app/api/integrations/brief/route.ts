import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { addLinkAttachments } from "@/lib/attachments";
import { notify } from "@/lib/notify";
import { sendGChatNotification } from "@/lib/gchat";
import { normalizeBriefType, resolveBriefDueDate } from "@/lib/brief-routing";

/**
 * Recibe los briefs que el cliente diligencia en n8n y los convierte en una
 * tarea dentro de un proyecto existente.
 *
 * El responsable NO viaja en el payload: sale de la tabla `brief_routings`
 * (pantalla /admin/integraciones), que mapea `briefType` → usuario. Así el
 * equipo puede reasignar tipos de brief sin tocar el workflow de n8n.
 *
 * El proyecto sí viaja en el payload: n8n siempre manda `projectId`.
 */

export const dynamic = "force-dynamic";

// ─── Payload ─────────────────────────────────────────────────────────────────

/**
 * El body que manda n8n es deliberadamente corto: los dos campos que deciden
 * dónde cae la tarea y quién la atiende, más el enlace al brief diligenciado.
 * El contenido del brief no se copia — vive en su origen y la tarea apunta ahí.
 *
 * Los campos de abajo del bloque «enriquecimiento» siguen aceptándose por si
 * algún día conviene volcar el brief entero en la descripción, pero no hacen
 * falta y no están documentados en la pantalla de administración.
 */
const payloadSchema = z.object({
  // ── Obligatorios ──
  /** Proyecto destino. n8n siempre lo manda. */
  projectId: z.string().min(1, "projectId es requerido"),
  /** Tipo de brief diligenciado; decide el responsable. */
  briefType: z.string().min(1, "briefType es requerido"),
  /**
   * Enlace al brief que diligenció el cliente (formulario, Drive, Notion...).
   * Es obligatorio a propósito: sin él y sin los campos de enriquecimiento, la
   * tarea nacería vacía y el responsable no tendría nada que abrir.
   */
  briefUrl: z.string().url("briefUrl debe ser una URL válida"),

  // ── Opcionales ──
  /**
   * Id de la ejecución en n8n. Si viene, el endpoint es idempotente: un
   * reintento devuelve la tarea ya creada en vez de duplicarla.
   */
  externalRef: z.string().min(1).max(191).optional(),
  /** Si no viene, el título sale del nombre de la regla más el consecutivo. */
  title: z.string().min(1).max(200).optional(),

  // ── Enriquecimiento (aceptado, no documentado) ──
  summary: z.string().optional(),

  client: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
    })
    .optional(),

  /** Respuestas del brief tal cual: { "Pregunta": "Respuesta", ... }. */
  fields: z.record(z.string(), z.unknown()).optional(),

  /** Adjuntos que el cliente subió (Drive, R2, lo que sea): se guardan como enlaces. */
  links: z.array(z.object({ url: z.string(), label: z.string().optional() })).optional(),

  /** Pisan los valores por defecto de la regla de enrutamiento. */
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]).optional(),
  category: z.string().max(80).optional(),
  dueDate: z.string().optional(),
  submittedAt: z.string().optional(),
});

type Payload = z.infer<typeof payloadSchema>;

// ─── Auth ────────────────────────────────────────────────────────────────────

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function verifyAuth(req: Request): boolean {
  // Trim: tolera un salto de línea accidental en la variable de entorno, que
  // si no provocaría un 401 silencioso (la comparación mira la longitud).
  const expected = process.env.INTEGRATION_BRIEF_TOKEN?.trim();
  if (!expected) return false;

  const provided = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!provided) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─── Formato de la descripción ───────────────────────────────────────────────

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
}

/** Arma la descripción de la tarea a partir del brief completo. */
function renderDescription(data: Payload): string {
  // El enlace va primero: en el flujo normal es lo único que lleva la tarea, y
  // es lo que el responsable necesita abrir para empezar.
  const blocks: string[] = [`**Brief diligenciado:** ${data.briefUrl}`];

  if (data.summary?.trim()) blocks.push(data.summary.trim());

  const client = data.client;
  if (client && (client.name || client.email || client.phone || client.company)) {
    const rows = [
      client.name ? `- Nombre: ${client.name}` : "",
      client.company ? `- Empresa: ${client.company}` : "",
      client.email ? `- Email: ${client.email}` : "",
      client.phone ? `- Teléfono: ${client.phone}` : "",
    ].filter(Boolean);
    blocks.push(`**Cliente**\n${rows.join("\n")}`);
  }

  const entries = Object.entries(data.fields ?? {});
  if (entries.length > 0) {
    const rows = entries.map(([key, value]) => `- **${key}:** ${renderValue(value)}`);
    blocks.push(`**Brief (${data.briefType})**\n${rows.join("\n")}`);
  }

  const meta = [
    data.submittedAt ? `- Diligenciado: ${data.submittedAt}` : "",
    data.externalRef ? `- Referencia n8n: ${data.externalRef}` : "",
  ].filter(Boolean);
  if (meta.length > 0) blocks.push(`**Origen**\n${meta.join("\n")}`);

  return blocks.join("\n\n");
}

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!verifyAuth(req)) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message, issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const briefType = normalizeBriefType(data.briefType);

  // Idempotencia: si n8n reintenta la misma ejecución, devolvemos la tarea que
  // ya se creó en vez de duplicarla.
  if (data.externalRef) {
    const existing = await prisma.task.findUnique({
      where: { externalRef: data.externalRef },
      select: { id: true, number: true, projectId: true, assignedToId: true },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        taskId: existing.id,
        taskNumber: existing.number,
        projectId: existing.projectId,
        assignedToId: existing.assignedToId,
        url: `/proyectos/${existing.projectId}/tareas/${existing.id}`,
      });
    }
  }

  const project = await prisma.project.findUnique({
    where: { id: data.projectId },
    select: {
      id: true,
      name: true,
      isPrivate: true,
      isActive: true,
      managerId: true,
      createdById: true,
    },
  });
  if (!project) {
    return NextResponse.json(
      { ok: false, error: `No existe el proyecto ${data.projectId}` },
      { status: 404 },
    );
  }

  const routing = await prisma.briefRouting.findUnique({
    where: { briefType },
    include: { assignedTo: { select: { id: true, name: true, isActive: true } } },
  });

  if (!routing || !routing.isActive) {
    const configured = await prisma.briefRouting.findMany({
      where: { isActive: true },
      select: { briefType: true },
    });
    return NextResponse.json(
      {
        ok: false,
        error: `No hay una regla activa para el brief "${briefType}". Configúrala en /admin/integraciones.`,
        briefTypesDisponibles: configured.map((r) => r.briefType),
      },
      { status: 422 },
    );
  }

  // Si el responsable quedó inactivo (alguien salió del equipo), la tarea se
  // crea igual pero sin asignar, para que no se pierda el brief.
  const assigneeIsUsable = routing.assignedTo.isActive;
  const assignedToId = assigneeIsUsable ? routing.assignedToId : null;

  // `createdBy` es obligatorio y el webhook no tiene sesión: responde el
  // proyecto (su manager, o quien lo creó).
  const createdById = project.managerId ?? project.createdById;

  // Fecha límite: manda lo que diga n8n; si no manda nada, se calcula con el
  // plazo en días hábiles de la regla. La hora límite es siempre la de la regla
  // — es el compromiso de entrega del equipo, no algo que decida el cliente.
  const explicitDueDate = parseDate(data.dueDate);
  const dueDate =
    explicitDueDate ??
    (routing.dueDays !== null ? resolveBriefDueDate(routing.dueDays) : null);
  const endTime = dueDate ? routing.dueTime : null;

  const task = await prisma.$transaction(async (tx) => {
    const last = await tx.task.findFirst({
      where: { projectId: project.id },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    const number = (last?.number ?? 0) + 1;

    // Sin `title` explícito, el consecutivo del proyecto es lo que distingue
    // una tarea de otra del mismo tipo de brief. Por eso el título se arma
    // aquí dentro y no antes: el número no existe hasta este punto.
    const title = data.title?.trim() || `${routing.label} #${number}`;

    return tx.task.create({
      data: {
        number,
        title:          title.slice(0, 200),
        description:    renderDescription(data),
        status:         "PENDIENTE",
        priority:       data.priority ?? routing.priority,
        category:       data.category?.trim() || routing.category,
        estimatedHours: routing.estimatedHours,
        projectId:      project.id,
        assignedToId,
        createdById,
        dueDate,
        endTime,
        externalRef:    data.externalRef ?? null,
        // El responsable del brief revisa su propia entrega; si no hay
        // responsable utilizable, revisa quien figure como creador.
        reviewers:      { connect: [{ id: assignedToId ?? createdById }] },
      },
    });
  });

  // El brief va como adjunto además de en la descripción: así aparece en el
  // panel de adjuntos de la tarea, que es donde el responsable busca fuentes.
  await addLinkAttachments({
    entityType: "TASK",
    entityId: task.id,
    links: [{ url: data.briefUrl, label: `Brief diligenciado — ${routing.label}` }, ...(data.links ?? [])],
    uploadedById: createdById,
  });

  const link = `/proyectos/${project.id}/tareas/${task.id}`;

  // Los proyectos privados no salen al canal de equipo.
  if (!project.isPrivate) {
    const parts = [`"${task.title}" en ${project.name}`, `Brief: ${routing.label}`];
    if (assigneeIsUsable) parts.push(`Asignado a: ${routing.assignedTo.name}`);
    if (task.dueDate) {
      const fmt = task.dueDate.toLocaleDateString("es-CO", {
        day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
      });
      parts.push(`Vence: ${fmt}${task.endTime ? ` a las ${task.endTime}` : ""}`);
    }
    await sendGChatNotification("task_new", "Nueva tarea desde brief", parts.join(" · "), link);
  }

  if (assignedToId) {
    await notify(
      assignedToId,
      "task_assigned",
      "Brief asignado",
      `Se te asignó: "${task.title}" en ${project.name}`,
      link,
      true, // asignación individual: no duplicar en el webhook de equipo
    );
  }

  return NextResponse.json({
    ok: true,
    taskId: task.id,
    taskNumber: task.number,
    projectId: project.id,
    assignedToId,
    assignedToName: assigneeIsUsable ? routing.assignedTo.name : null,
    briefType,
    // Fecha límite resuelta, para que n8n pueda confirmársela al cliente.
    dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
    dueTime: task.endTime,
    url: link,
    // Señal para que n8n pueda alertar en su canal si un brief cae sin dueño.
    warning: assigneeIsUsable
      ? undefined
      : `El responsable configurado para "${briefType}" está inactivo; la tarea quedó sin asignar.`,
  });
}
