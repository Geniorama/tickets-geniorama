"use server";

import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { taskCode, projectPrefix } from "@/lib/task-code";
import { runTextCompletion, type AiProvider } from "@/lib/ai";
import { listComments } from "@/lib/comments";
import { listTimeEntries, totalElapsedMs } from "@/lib/time-entries";
import {
  parseReportPeriod,
  isWithin,
  plainCommentBody,
  truncate,
  linksInText,
  dedupeDeliverables,
  hostOf,
  type Deliverable,
} from "@/lib/reports";

export interface ReportHeader {
  projectName?: string;
  itemName: string;
  itemCode?: string;
  reportDate: string;
  /** Solo en los informes acotados a un rango: «7 al 9 de septiembre de 2026». */
  period?: string;
  projectManager?: string;
  responsible?: string;
  client?: string;
  status: string;
  priority?: string;
  progress?: string;
}

export interface GeneratedReport {
  header: ReportHeader;
  body: string;
}

const priorityLabel: Record<string, string> = {
  BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", CRITICA: "Crítica",
};
const statusLabel: Record<string, string> = {
  PENDIENTE: "Pendiente", EN_PROGRESO: "En progreso", EN_REVISION: "En revisión",
  COMPLETADO: "Completado", POR_ASIGNAR: "Por asignar", ABIERTO: "Abierto", CERRADO: "Cerrado",
};

function today() {
  return new Date().toLocaleDateString("es-CO", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

async function callAi(prompt: string, provider: AiProvider): Promise<string> {
  return Promise.race([
    runTextCompletion({ provider, prompt }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AI timeout (30s)")), 30000),
    ),
  ]);
}

// ─── Tarea ────────────────────────────────────────────────────────────────────

export async function generateTaskReport(taskId: string, provider: AiProvider = "gemini"): Promise<{ error?: string; report?: GeneratedReport }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: {
        select: {
          name: true,
          manager: { select: { name: true } },
          status: true,
        },
      },
      assignedTo: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  if (!task) return { error: "Tarea no encontrada" };

  // Los comentarios viven en la tabla compartida, fuera de la relación.
  const comments = (
    await listComments({ entityType: "TASK", entityId: taskId, includeInternal: true })
  ).slice(0, 100);

  // El tiempo vive en la tabla compartida, fuera de la relación.
  const timeEntries = await listTimeEntries({ entityType: "TASK", entityId: taskId });

  const projectName = task.project?.name ?? "Sin proyecto";
  const code = task.number > 0 ? taskCode(projectName, task.number) : undefined;
  const prefix = projectPrefix(projectName);

  const header: ReportHeader = {
    projectName,
    itemName: task.title,
    itemCode: code,
    reportDate: today(),
    projectManager: task.project?.manager?.name ?? "Sin responsable",
    responsible: task.assignedTo?.name ?? "Sin asignar",
    status: statusLabel[task.status] ?? task.status,
    priority: priorityLabel[task.priority] ?? task.priority,
  };

  // Build context for AI
  let ctx = `**Proyecto:** ${projectName}
**Tarea:** ${task.title}${code ? ` (${code})` : ""}
**Estado:** ${header.status}
**Prioridad:** ${header.priority}${task.category ? `\n**Categoría:** ${task.category}` : ""}
**Creado por:** ${task.createdBy.name}
**Asignado a:** ${header.responsible}
**Fecha de inicio:** ${task.startDate ? task.startDate.toLocaleDateString("es-CO") : "No definida"}
**Fecha límite:** ${task.dueDate ? task.dueDate.toLocaleDateString("es-CO") : "No definida"}

**Descripción:**
${task.description}`;

  if (comments.length > 0) {
    ctx += `\n\n**Historial de comentarios:**`;
    for (const c of comments) {
      ctx += `\n- ${c.createdAt.toLocaleDateString("es-CO")} — ${c.author.name}: ${c.body}`;
    }
  }

  if (timeEntries.length > 0) {
    const totalMinutes = Math.round(totalElapsedMs(timeEntries) / 60000);
    ctx += `\n\n**Tiempo registrado:** ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
    ctx += `\n**Entradas de tiempo:**`;
    for (const e of timeEntries) {
      if (!e.stoppedAt) continue;
      const mins = Math.round((e.stoppedAt.getTime() - e.startedAt.getTime()) / 60000);
      ctx += `\n- ${e.startedAt.toLocaleDateString("es-CO")} — ${e.user.name}: ${Math.floor(mins / 60)}h ${mins % 60}m`;
    }
  }

  const prompt = `Eres un asistente profesional de gestión de proyectos en la agencia Geniorama.
Genera un informe ejecutivo detallado sobre la siguiente tarea de proyecto.

El informe debe incluir:
1. **Resumen ejecutivo** — descripción general del trabajo y su propósito
2. **Estado y avance** — análisis del estado actual con base en los comentarios y tiempo registrado
3. **Historial de actividad** — cronología de los eventos clave con fechas para trazabilidad
4. **Tiempo invertido** — análisis del tiempo registrado (si existe)
5. **Conclusiones y próximos pasos** — recomendaciones concretas

Usa el código de tarea **${prefix}-** para referencias internas.
Redacta en español formal, de forma clara y estructurada. Usa markdown.

---
${ctx}`;

  try {
    const body = await callAi(prompt, provider);
    return { report: { header, body } };
  } catch {
    return { error: "Error al generar el informe con IA." };
  }
}

// ─── Proyecto ─────────────────────────────────────────────────────────────────

const projectStatusLabel: Record<string, string> = {
  PLANIFICACION: "Planificación",
  EN_DESARROLLO: "En desarrollo",
  EN_REVISION: "En revisión",
  COMPLETADO: "Completado",
  PAUSADO: "Pausado",
};

export interface ProjectReportOptions {
  includeAssignees: boolean;
  extraInstructions: string;
  /** «YYYY-MM-DD», inclusive. Acota el informe a un periodo. */
  from?: string;
  /** «YYYY-MM-DD», inclusive. */
  to?: string;
  /** Pasar el hilo de comentarios (sin notas internas) como contexto. */
  includeComments?: boolean;
}

/** Comentario visible para el cliente, reducido a lo que el informe usa. */
type ReportComment = {
  entityId: string;
  body: string;
  createdAt: Date;
  attachmentUrl: string | null;
  attachmentName: string | null;
  author: { name: string };
  attachments: { type: string; url: string; name: string | null }[];
};

/** Tope de tareas que se leen del proyecto antes de acotar por periodo. */
const MAX_TASKS = 500;
/** Tope de comentarios por tarea que entran al contexto. */
const MAX_COMMENTS_PER_TASK = 12;

export async function generateProjectReport(
  projectId: string,
  options: ProjectReportOptions,
  provider: AiProvider = "gemini",
): Promise<{ error?: string; report?: GeneratedReport }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      company: { select: { name: true } },
      manager: { select: { name: true } },
      createdBy: { select: { name: true } },
      tasks: {
        // Un borrador no es trabajo que se le pueda contar al cliente.
        where: { isDraft: false },
        take: MAX_TASKS,
        include: { assignedTo: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) return { error: "Proyecto no encontrado" };

  const period = parseReportPeriod(options.from, options.to, project.startDate ?? project.createdAt);
  const allTasks = project.tasks;
  const taskIds = allTasks.map((t) => t.id);
  const wantsComments = options.includeComments !== false;

  // ── Contexto de las tareas ──────────────────────────────────────────────────
  // Comentarios, adjuntos y cierres viven en las tablas compartidas: ninguno
  // cuelga ya de la relación directa con `tasks`.

  // Se leen incluso con los comentarios desactivados: con periodo, un
  // comentario es la señal de que la tarea tuvo movimiento esa semana. Lo que
  // la casilla decide es si su texto entra al informe, no si cuenta para el
  // alcance.
  const comments: ReportComment[] =
    (wantsComments || period) && taskIds.length > 0
      ? await prisma.comment.findMany({
          where: {
            entityType: "TASK",
            entityId: { in: taskIds },
            // El informe es para el cliente: las notas internas no salen.
            isInternal: false,
            ...(period ? { createdAt: { gte: period.from, lte: period.to } } : {}),
          },
          select: {
            entityId: true,
            body: true,
            createdAt: true,
            attachmentUrl: true,
            attachmentName: true,
            author: { select: { name: true } },
            attachments: { select: { type: true, url: true, name: true } },
          },
          // Descendente y luego al revés: si un proyecto largo pasa del tope,
          // lo que se pierde es lo viejo, no lo que se acaba de hacer.
          orderBy: { createdAt: "desc" },
          take: 800,
        })
      : [];

  const commentsByTask = new Map<string, ReportComment[]>();
  for (const c of comments.reverse()) {
    const list = commentsByTask.get(c.entityId) ?? [];
    list.push(c);
    commentsByTask.set(c.entityId, list);
  }

  const attachments =
    taskIds.length > 0
      ? await prisma.attachment.findMany({
          where: { entityType: "TASK", entityId: { in: taskIds } },
          select: { entityId: true, fileName: true, fileUrl: true, createdAt: true },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          take: 500,
        })
      : [];

  type ReportAttachment = (typeof attachments)[number];
  const attachmentsByTask = new Map<string, ReportAttachment[]>();
  for (const a of attachments) {
    const list = attachmentsByTask.get(a.entityId) ?? [];
    list.push(a);
    attachmentsByTask.set(a.entityId, list);
  }

  // Qué se cerró dentro del periodo. El historial lo sabe con exactitud;
  // `updatedAt` es el recurso para lo completado antes de que existiera.
  const closedInPeriod = new Set<string>();
  if (period && taskIds.length > 0) {
    const logs = await prisma.activityLog.findMany({
      where: {
        entityType: "TASK",
        entityId: { in: taskIds },
        action: "task.completed",
        createdAt: { gte: period.from, lte: period.to },
      },
      select: { entityId: true },
    });
    for (const l of logs) closedInPeriod.add(l.entityId);
    for (const t of allTasks) {
      if (t.status === "COMPLETADO" && isWithin(t.updatedAt, period)) closedInPeriod.add(t.id);
    }
  }

  // ── Alcance ─────────────────────────────────────────────────────────────────
  // Una tarea entra en un informe de periodo si se cerró dentro, si nació
  // dentro, si su ventana de trabajo lo cruza o si tuvo movimiento (un
  // comentario, un entregable). Lo demás no existe para este informe.

  const tasks = period
    ? allTasks.filter((t) => {
        if (closedInPeriod.has(t.id)) return true;
        if (isWithin(t.createdAt, period)) return true;
        if (isWithin(t.startDate, period) || isWithin(t.dueDate, period)) return true;
        if (t.startDate && t.dueDate && t.startDate <= period.to && t.dueDate >= period.from) return true;
        if ((commentsByTask.get(t.id)?.length ?? 0) > 0) return true;
        return (attachmentsByTask.get(t.id) ?? []).some((a) => isWithin(a.createdAt, period));
      })
    : allTasks;

  if (period && tasks.length === 0) {
    return { error: `No hay tareas con actividad entre el ${period.label}.` };
  }

  const prefix = projectPrefix(project.name);
  const completed = period
    ? tasks.filter((t) => closedInPeriod.has(t.id)).length
    : tasks.filter((t) => t.status === "COMPLETADO").length;

  const header: ReportHeader = {
    itemName: project.name,
    itemCode: prefix,
    reportDate: today(),
    period: period?.label,
    projectManager: project.manager?.name ?? "Sin responsable",
    client: project.company?.name,
    status: projectStatusLabel[project.status] ?? project.status,
    // Con periodo, el avance es el del periodo: un porcentaje global aquí es
    // justo el dato que un informe de sprint no debe dar.
    progress: period
      ? `${completed} de ${tasks.length} tareas del periodo finalizadas`
      : `${tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0}% (${completed}/${tasks.length} tareas completadas)`,
  };

  // ── Bloque de datos ─────────────────────────────────────────────────────────

  let ctx = `**Proyecto:** ${project.name}
**Estado del proyecto:** ${header.status}
**Responsable:** ${header.projectManager}${project.company ? `\n**Empresa cliente:** ${project.company.name}` : ""}
**Fecha de inicio:** ${project.startDate ? project.startDate.toLocaleDateString("es-CO") : "No definida"}
**Fecha límite:** ${project.dueDate ? project.dueDate.toLocaleDateString("es-CO") : "No definida"}

**Descripción:**
${project.description}`;

  const byStatus: Record<string, number> = {};
  for (const t of tasks) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  const statusSummary = Object.entries(byStatus)
    .map(([s, n]) => `${statusLabel[s] ?? s}: ${n}`)
    .join(", ");

  ctx += period
    ? `\n\n**Tareas del periodo ${period.label} (${tasks.length} en total — son TODAS las que existen para este informe):** ${statusSummary}`
    : `\n\n**Resumen de tareas (${tasks.length} en total):** ${statusSummary}`;

  const allDeliverables: Deliverable[] = [];

  ctx += `\n\n**Detalle de las tareas:**`;
  for (const t of tasks) {
    const code = t.number > 0 ? taskCode(project.name, t.number) : "";
    const assignee = options.includeAssignees && t.assignedTo ? ` | Encargado: ${t.assignedTo.name}` : "";
    const start = t.startDate ? ` | Inicio: ${t.startDate.toLocaleDateString("es-CO")}` : "";
    const due = t.dueDate ? ` | Vence: ${t.dueDate.toLocaleDateString("es-CO")}` : "";
    const closed = period && closedInPeriod.has(t.id) ? " | FINALIZADA EN EL PERIODO" : "";
    const st = statusLabel[t.status] ?? t.status;

    ctx += `\n\n- ${code ? `[${code}] ` : ""}${t.title} — ${st}${start}${due}${assignee}${closed}`;
    if (t.description) ctx += `\n  Descripción: ${truncate(t.description, 400)}`;

    // Entregables de la tarea: adjuntos de la ficha, adjuntos de los
    // comentarios y los enlaces que alguien pegó escribiendo.
    const taskComments = wantsComments
      ? (commentsByTask.get(t.id) ?? []).slice(-MAX_COMMENTS_PER_TASK)
      : [];
    const deliverables = dedupeDeliverables([
      ...(attachmentsByTask.get(t.id) ?? []).map((a) => ({ name: a.fileName, url: a.fileUrl })),
      ...taskComments.flatMap((c) => [
        ...c.attachments.map((a) => ({ name: a.name ?? hostOf(a.url), url: a.url })),
        ...(c.attachmentUrl ? [{ name: c.attachmentName ?? hostOf(c.attachmentUrl), url: c.attachmentUrl }] : []),
        ...linksInText(c.body).map((url) => ({ name: hostOf(url), url })),
      ]),
    ]);

    if (taskComments.length > 0) {
      ctx += `\n  Comentarios del equipo:`;
      for (const c of taskComments) {
        ctx += `\n    · ${c.createdAt.toLocaleDateString("es-CO")} — ${c.author.name}: ${truncate(plainCommentBody(c.body), 500)}`;
      }
    }

    if (deliverables.length > 0) {
      ctx += `\n  Entregables de la tarea:`;
      for (const d of deliverables) ctx += `\n    · ${d.name} → ${d.url}`;
      allDeliverables.push(...deliverables);
    }
  }

  // ── Prompt ──────────────────────────────────────────────────────────────────
  // El orden importa: primero lo que no se puede romper, al final el
  // recordatorio. Las instrucciones del solicitante iban antes al fondo del
  // prompt, donde el modelo las trataba como una sugerencia más.

  const scopeBlock = period
    ? `## ALCANCE OBLIGATORIO — LÉELO ANTES QUE NADA
Este informe cubre EXCLUSIVAMENTE el periodo del ${period.label}.
El bloque de datos ya viene filtrado: las ${tasks.length} tareas que aparecen ahí son las únicas que existen para este informe.

Reglas que no puedes romper:
- No menciones, enumeres, resumas ni cuentes ninguna tarea que no esté en el bloque de datos.
- No des el total de tareas del proyecto, ni un porcentaje de avance global, ni hables de lo que quedó fuera del periodo. No tienes ese dato y no debes estimarlo.
- Todo conteo, porcentaje y comparación se calcula solo sobre esas ${tasks.length} tareas.
- Las marcadas como «FINALIZADA EN EL PERIODO» son las que se cerraron dentro del rango: son el resultado del periodo.
- No inventes tareas, fechas, entregables ni avances que no estén en los datos.

`
    : "";

  const extraBlock = options.extraInstructions.trim()
    ? `## INSTRUCCIONES DEL SOLICITANTE — PRIORIDAD MÁXIMA
Mandan sobre la estructura sugerida de más abajo. Si algo se contradice, gana esto:
${options.extraInstructions.trim()}

`
    : "";

  const deliverablesSection =
    allDeliverables.length > 0
      ? `\n5. **Entregables** — lista los archivos y enlaces entregados en formato markdown [nombre](url), agrupados por tarea. Copia las URL tal cual aparecen en los datos, sin modificarlas ni inventar ninguna.`
      : `\n5. **Entregables** — indica que en este ${period ? "periodo" : "proyecto"} no se registraron entregables adjuntos.`;

  const prompt = `Eres un asistente profesional de gestión de proyectos en la agencia Geniorama.
Redactas un informe de avance DIRIGIDO AL CLIENTE: tono profesional y cercano, enfocado en el progreso y en el valor entregado. Nada de jerga interna, discusiones del equipo ni detalles técnicos que el cliente no necesite.

${scopeBlock}${extraBlock}## ESTRUCTURA SUGERIDA
1. **Resumen ejecutivo** — qué se trabajó${period ? ` entre el ${period.label}` : " en el proyecto"} y qué significa para el cliente
2. **Avance y resultados** — lo que se completó, apoyado en los comentarios del equipo
3. **Trabajo en curso** — lo que quedó abierto y en qué punto está
4. **Cronología** — los hitos con sus fechas, para dar trazabilidad${deliverablesSection}
6. **Conclusiones y próximos pasos** — recomendaciones concretas

Los comentarios del equipo son la fuente para explicar QUÉ se hizo realmente en cada tarea: úsalos, no te quedes en el título y el estado.
Redacta en español, en markdown, de forma clara y estructurada.

---
DATOS DEL INFORME
---
${ctx}
---
${period ? `RECORDATORIO FINAL: el informe habla únicamente del ${period.label} y de las ${tasks.length} tareas listadas arriba. Cualquier otra tarea del proyecto queda fuera.` : ""}`;

  try {
    const body = await callAi(prompt, provider);
    return { report: { header, body } };
  } catch {
    return { error: "Error al generar el informe con IA." };
  }
}


// ─── Ticket ───────────────────────────────────────────────────────────────────

export async function generateTicketReport(ticketId: string, provider: AiProvider = "gemini"): Promise<{ error?: string; report?: GeneratedReport }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      createdBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      client: { select: { name: true, companies: { select: { name: true } } } },
      plan: { select: { name: true, type: true } },
      site: { select: { name: true, domain: true } },
    },
  });

  if (!ticket) return { error: "Ticket no encontrado" };

  // Los comentarios viven en la tabla compartida. El informe es para el cliente,
  // así que las notas internas quedan fuera.
  const comments = (
    await listComments({ entityType: "TICKET", entityId: ticketId, includeInternal: false })
  ).slice(0, 100);

  // El tiempo tampoco cuelga ya del ticket.
  const timeEntries = await listTimeEntries({ entityType: "TICKET", entityId: ticketId });

  const header: ReportHeader = {
    itemName: ticket.title,
    reportDate: today(),
    responsible: ticket.assignedTo?.name ?? "Sin asignar",
    client: ticket.client
      ? `${ticket.client.name}${ticket.client.companies.length > 0 ? ` (${ticket.client.companies[0].name})` : ""}`
      : undefined,
    status: statusLabel[ticket.status] ?? ticket.status,
    priority: priorityLabel[ticket.priority] ?? ticket.priority,
  };

  let ctx = `**Ticket:** ${ticket.title}
**Estado:** ${header.status}
**Prioridad:** ${header.priority}${ticket.category ? `\n**Categoría:** ${ticket.category}` : ""}
**Creado por:** ${ticket.createdBy.name}
**Asignado a:** ${header.responsible}
**Creado el:** ${ticket.createdAt.toLocaleDateString("es-CO")}
**Última actualización:** ${ticket.updatedAt.toLocaleDateString("es-CO")}${ticket.dueDate ? `\n**Fecha límite:** ${ticket.dueDate.toLocaleDateString("es-CO")}` : ""}${header.client ? `\n**Cliente:** ${header.client}` : ""}${ticket.site ? `\n**Sitio afectado:** ${ticket.site.name} (${ticket.site.domain})` : ""}

**Descripción:**
${ticket.description}`;

  if (comments.length > 0) {
    ctx += `\n\n**Historial de comunicación:**`;
    for (const c of comments) {
      ctx += `\n- ${c.createdAt.toLocaleDateString("es-CO")} — ${c.author.name}: ${c.body}`;
    }
  }

  if (timeEntries.length > 0) {
    const totalMinutes = Math.round(totalElapsedMs(timeEntries) / 60000);
    ctx += `\n\n**Tiempo registrado:** ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  }

  const prompt = `Eres un asistente profesional de la agencia Geniorama.
Genera un informe ejecutivo detallado sobre el siguiente ticket de soporte/servicio.

El informe debe incluir:
1. **Resumen ejecutivo** — descripción de la incidencia o solicitud y su contexto
2. **Análisis de la situación** — evaluación del estado con base en la información disponible
3. **Historial de actividad** — cronología de los eventos con fechas para trazabilidad
4. **Tiempo invertido** — análisis del tiempo registrado (si existe)
5. **Resolución y conclusiones** — descripción de la solución aplicada o estado actual, y recomendaciones

Redacta en español formal, de forma clara y estructurada. Usa markdown.

---
${ctx}`;

  try {
    const body = await callAi(prompt, provider);
    return { report: { header, body } };
  } catch {
    return { error: "Error al generar el informe con IA." };
  }
}
