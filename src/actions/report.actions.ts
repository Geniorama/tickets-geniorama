"use server";

import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { taskCode, projectPrefix } from "@/lib/task-code";

export interface ReportHeader {
  projectName?: string;
  itemName: string;
  itemCode?: string;
  reportDate: string;
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

async function callGemini(prompt: string): Promise<string> {
  const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_AI_API_KEY!,
    httpOptions: { baseUrl: "https://generativelanguage.googleapis.com" },
  });
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });
  return response.text ?? "";
}

// ─── Tarea ────────────────────────────────────────────────────────────────────

export async function generateTaskReport(taskId: string): Promise<{ error?: string; report?: GeneratedReport }> {
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
      comments: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      timeEntries: {
        include: { user: { select: { name: true } } },
        orderBy: { startedAt: "asc" },
      },
    },
  });

  if (!task) return { error: "Tarea no encontrada" };

  const code = task.number > 0 ? taskCode(task.project.name, task.number) : undefined;
  const prefix = projectPrefix(task.project.name);

  const header: ReportHeader = {
    projectName: task.project.name,
    itemName: task.title,
    itemCode: code,
    reportDate: today(),
    projectManager: task.project.manager?.name ?? "Sin responsable",
    responsible: task.assignedTo?.name ?? "Sin asignar",
    status: statusLabel[task.status] ?? task.status,
    priority: priorityLabel[task.priority] ?? task.priority,
  };

  // Build context for AI
  let ctx = `**Proyecto:** ${task.project.name}
**Tarea:** ${task.title}${code ? ` (${code})` : ""}
**Estado:** ${header.status}
**Prioridad:** ${header.priority}${task.category ? `\n**Categoría:** ${task.category}` : ""}
**Creado por:** ${task.createdBy.name}
**Asignado a:** ${header.responsible}
**Fecha de inicio:** ${task.startDate ? task.startDate.toLocaleDateString("es-CO") : "No definida"}
**Fecha límite:** ${task.dueDate ? task.dueDate.toLocaleDateString("es-CO") : "No definida"}

**Descripción:**
${task.description}`;

  if (task.comments.length > 0) {
    ctx += `\n\n**Historial de comentarios:**`;
    for (const c of task.comments) {
      ctx += `\n- ${c.createdAt.toLocaleDateString("es-CO")} — ${c.author.name}: ${c.body}`;
    }
  }

  if (task.timeEntries.length > 0) {
    const totalMinutes = task.timeEntries.reduce((acc, e) => {
      if (!e.stoppedAt) return acc;
      return acc + Math.round((e.stoppedAt.getTime() - e.startedAt.getTime()) / 60000);
    }, 0);
    ctx += `\n\n**Tiempo registrado:** ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
    ctx += `\n**Entradas de tiempo:**`;
    for (const e of task.timeEntries) {
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
    const body = await callGemini(prompt);
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

export async function generateProjectReport(
  projectId: string,
  options: { includeAssignees: boolean; extraInstructions: string },
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
        include: {
          assignedTo: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) return { error: "Proyecto no encontrado" };

  const totalTasks = project.tasks.length;
  const completedTasks = project.tasks.filter((t) => t.status === "COMPLETADO").length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const prefix = projectPrefix(project.name);

  const header: ReportHeader = {
    itemName: project.name,
    itemCode: prefix,
    reportDate: today(),
    projectManager: project.manager?.name ?? "Sin responsable",
    client: project.company?.name,
    status: projectStatusLabel[project.status] ?? project.status,
    progress: `${progressPct}% (${completedTasks}/${totalTasks} tareas completadas)`,
  };

  // Build context
  let ctx = `**Proyecto:** ${project.name}
**Estado:** ${header.status}
**Progreso:** ${header.progress}
**Responsable:** ${header.projectManager}${project.company ? `\n**Empresa:** ${project.company.name}` : ""}
**Fecha de inicio:** ${project.startDate ? project.startDate.toLocaleDateString("es-CO") : "No definida"}
**Fecha límite:** ${project.dueDate ? project.dueDate.toLocaleDateString("es-CO") : "No definida"}
**Creado el:** ${project.createdAt.toLocaleDateString("es-CO")}

**Descripción:**
${project.description}`;

  // Task summary by status
  const byStatus: Record<string, number> = {};
  for (const t of project.tasks) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  }
  const statusSummary = Object.entries(byStatus)
    .map(([s, n]) => `${statusLabel[s] ?? s}: ${n}`)
    .join(", ");
  if (totalTasks > 0) {
    ctx += `\n\n**Resumen de tareas (${totalTasks} en total):** ${statusSummary}`;
  }

  // Task list with dates (and optionally assignees)
  if (project.tasks.length > 0) {
    ctx += `\n\n**Listado de tareas:**`;
    for (const t of project.tasks) {
      const code = t.number > 0 ? taskCode(project.name, t.number) : "";
      const assignee = options.includeAssignees && t.assignedTo ? ` — Encargado: ${t.assignedTo.name}` : "";
      const start = t.startDate ? ` | Inicio: ${t.startDate.toLocaleDateString("es-CO")}` : "";
      const due = t.dueDate ? ` | Vence: ${t.dueDate.toLocaleDateString("es-CO")}` : "";
      const st = statusLabel[t.status] ?? t.status;
      ctx += `\n- ${code ? `[${code}] ` : ""}${t.title} — ${st}${start}${due}${assignee}`;
    }
  }

  const extraBlock = options.extraInstructions.trim()
    ? `\n\nInstrucciones adicionales del solicitante:\n${options.extraInstructions.trim()}`
    : "";

  const prompt = `Eres un asistente profesional de gestión de proyectos en la agencia Geniorama.
Genera un informe ejecutivo detallado sobre el siguiente proyecto.

El informe debe incluir:
1. **Resumen ejecutivo** — descripción general del proyecto y su propósito
2. **Estado y avance** — análisis del porcentaje de avance y estado actual con base en las tareas
3. **Cronograma** — análisis de fechas clave (inicio, vencimiento, tareas próximas a vencer o vencidas)
4. **Desglose de tareas** — análisis de las tareas por estado y prioridad${options.includeAssignees ? ", incluyendo los encargados" : ""}
5. **Conclusiones y próximos pasos** — recomendaciones concretas para avanzar el proyecto

Redacta en español formal, de forma clara y estructurada. Usa markdown.${extraBlock}

---
${ctx}`;

  try {
    const body = await callGemini(prompt);
    return { report: { header, body } };
  } catch {
    return { error: "Error al generar el informe con IA." };
  }
}

// ─── Ticket ───────────────────────────────────────────────────────────────────

export async function generateTicketReport(ticketId: string): Promise<{ error?: string; report?: GeneratedReport }> {
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
      comments: {
        where: { isInternal: false },
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      timeEntries: {
        include: { user: { select: { name: true } } },
        orderBy: { startedAt: "asc" },
      },
    },
  });

  if (!ticket) return { error: "Ticket no encontrado" };

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

  if (ticket.comments.length > 0) {
    ctx += `\n\n**Historial de comunicación:**`;
    for (const c of ticket.comments) {
      ctx += `\n- ${c.createdAt.toLocaleDateString("es-CO")} — ${c.author.name}: ${c.body}`;
    }
  }

  if (ticket.timeEntries.length > 0) {
    const totalMinutes = ticket.timeEntries.reduce((acc, e) => {
      if (!e.stoppedAt) return acc;
      return acc + Math.round((e.stoppedAt.getTime() - e.startedAt.getTime()) / 60000);
    }, 0);
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
    const body = await callGemini(prompt);
    return { report: { header, body } };
  } catch {
    return { error: "Error al generar el informe con IA." };
  }
}
