"use server";

import { Type, type FunctionDeclaration } from "@google/genai";
import type OpenAI from "openai";
import { runAssistantChat, providerConfigError, isValidProvider, type AiProvider, type ChatMsg } from "@/lib/ai";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { notify } from "@/lib/notify";
import { sendGChatNotification } from "@/lib/gchat";
import type { TaskStatus, TicketStatus, Priority } from "@/generated/prisma";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type ChatMessage = { role: "user" | "assistant"; text: string };
export type { AiProvider } from "@/lib/ai";

/** Acción concreta que el asistente propone y el usuario confirma con un clic. */
export type ProposedAction =
  | { kind: "status"; taskId: string; taskLabel: string; estado: TaskStatus }
  | { kind: "checklist"; taskId: string; taskLabel: string; items: string[] }
  | {
      kind: "create";
      projectId: string;
      projectLabel: string;
      titulo: string;
      descripcion: string;
      prioridad: Priority;
    };

const STATUS_VALUES: TaskStatus[] = ["PENDIENTE", "EN_PROGRESO", "EN_REVISION", "COMPLETADO"];
const PRIORITY_VALUES: Priority[] = ["BAJA", "MEDIA", "ALTA", "CRITICA"];

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDIENTE: "Pendiente",
  EN_PROGRESO: "En progreso",
  EN_REVISION: "En revisión",
  COMPLETADO: "Completado",
};
const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  POR_ASIGNAR: "Por asignar",
  ABIERTO: "Abierto",
  EN_PROGRESO: "En progreso",
  EN_REVISION: "En revisión",
  CERRADO: "Cerrado",
};
const PRIORITY_LABELS: Record<Priority, string> = {
  BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", CRITICA: "Crítica",
};

function fmt(d: Date) {
  return format(d, "d MMM yyyy", { locale: es });
}

type CommentLite = {
  body: string;
  isInternal?: boolean;
  author: { name: string | null };
};

/** Formatea los comentarios (más recientes) en líneas compactas, del más
 *  antiguo al más nuevo, truncando textos largos. */
function formatComments(comments: CommentLite[]): string {
  if (comments.length === 0) return "";
  const ordered = [...comments].reverse(); // vienen desc → mostrar asc
  return ordered
    .map((c) => {
      const body = c.body.length > 220 ? `${c.body.slice(0, 220)}…` : c.body;
      const tag = c.isInternal ? " [interno]" : "";
      return `    · ${c.author.name ?? "Usuario"}${tag}: ${body.replace(/\s+/g, " ").trim()}`;
    })
    .join("\n");
}

// ─── Contexto del colaborador ─────────────────────────────────────────────────

type TaskCtx = {
  id: string;
  title: string;
  projectId: string | null;
  projectName: string;
};

type AssistantContext = {
  contextText: string;
  taskMap: Map<string, TaskCtx>;
  projectMap: Map<string, string>; // projectId -> name
};

async function buildContext(userId: string): Promise<AssistantContext> {
  const now = new Date();

  const [tasks, tickets, reviewTasks, reviewTickets, projects] = await Promise.all([
    prisma.task.findMany({
      where: {
        assignedToId: userId,
        isDraft: false,
        status: { in: ["PENDIENTE", "EN_PROGRESO", "EN_REVISION"] },
      },
      select: {
        id: true,
        number: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        category: true,
        startDate: true,
        dueDate: true,
        estimatedHours: true,
        project: { select: { id: true, name: true } },
        _count: { select: { checklistItems: true } },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 4,
          select: { body: true, author: { select: { name: true } } },
        },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 40,
    }),
    // Tickets activos asignados al colaborador (solo lectura, para diagnóstico)
    prisma.ticket.findMany({
      where: {
        assignedToId: userId,
        isDraft: false,
        status: { not: "CERRADO" },
      },
      select: {
        prefix: true,
        number: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        category: true,
        dueDate: true,
        site: { select: { name: true, domain: true } },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 4,
          select: { body: true, isInternal: true, author: { select: { name: true } } },
        },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 25,
    }),
    // Tareas pendientes de la revisión de este usuario (es revisor y no el asignado)
    prisma.task.findMany({
      where: {
        reviewers: { some: { id: userId } },
        status: "EN_REVISION",
        isDraft: false,
        assignedToId: { not: userId },
      },
      select: {
        id: true,
        number: true,
        title: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 25,
    }),
    // Tickets pendientes de la revisión de este usuario (es revisor y no el asignado)
    prisma.ticket.findMany({
      where: {
        reviewers: { some: { id: userId } },
        status: "EN_REVISION",
        isDraft: false,
        assignedToId: { not: userId },
      },
      select: {
        prefix: true,
        number: true,
        title: true,
        priority: true,
        dueDate: true,
        assignedTo: { select: { name: true } },
        site: { select: { name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 25,
    }),
    // Proyectos donde el colaborador puede crear tareas (gestiona o tiene tareas asignadas)
    prisma.project.findMany({
      where: {
        isActive: true,
        OR: [{ managerId: userId }, { tasks: { some: { assignedToId: userId } } }],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 60,
    }),
  ]);

  const taskMap = new Map<string, TaskCtx>();
  const projectMap = new Map<string, string>();
  for (const p of projects) projectMap.set(p.id, p.name);

  const lines: string[] = [];
  for (const t of tasks) {
    const projectName = t.project?.name ?? "Sin proyecto";
    taskMap.set(t.id, { id: t.id, title: t.title, projectId: t.project?.id ?? null, projectName });

    const parts: string[] = [
      `ID:${t.id}`,
      `#${t.number} "${t.title}"`,
      `Proyecto: ${projectName}`,
      `Estado: ${STATUS_LABELS[t.status]}`,
      `Prioridad: ${PRIORITY_LABELS[t.priority]}`,
    ];
    if (t.category) parts.push(`Categoría: ${t.category}`);
    if (t.startDate) parts.push(`Inicio: ${fmt(t.startDate)}`);
    if (t.dueDate) {
      const overdue = t.dueDate < now && t.status !== "EN_REVISION";
      parts.push(`Vence: ${fmt(t.dueDate)}${overdue ? " (VENCIDA)" : ""}`);
    }
    if (t.estimatedHours) parts.push(`Estimado: ${t.estimatedHours}h`);
    if (t._count.checklistItems > 0) parts.push(`Checklist: ${t._count.checklistItems} ítems`);
    let line = `- ${parts.join(" · ")}`;
    if (t.comments.length > 0) {
      line += `\n  Comentarios recientes:\n${formatComments(t.comments)}`;
    }
    lines.push(line);
  }

  // Tickets activos asignados (solo lectura)
  const ticketLines: string[] = [];
  for (const tk of tickets) {
    const code = tk.prefix ? `${tk.prefix}-${tk.number}` : `#${tk.number}`;
    const parts: string[] = [
      `${code} "${tk.title}"`,
      `Estado: ${TICKET_STATUS_LABELS[tk.status]}`,
      `Prioridad: ${PRIORITY_LABELS[tk.priority]}`,
    ];
    if (tk.category) parts.push(`Categoría: ${tk.category}`);
    if (tk.site) parts.push(`Sitio: ${tk.site.name}${tk.site.domain ? ` (${tk.site.domain})` : ""}`);
    if (tk.dueDate) {
      const overdue = tk.dueDate < now && tk.status !== "EN_REVISION";
      parts.push(`Vence: ${fmt(tk.dueDate)}${overdue ? " (VENCIDO)" : ""}`);
    }
    let line = `- ${parts.join(" · ")}`;
    if (tk.comments.length > 0) {
      line += `\n  Comentarios recientes:\n${formatComments(tk.comments)}`;
    }
    ticketLines.push(line);
  }

  // Tareas pendientes de revisión por este usuario (es revisor)
  const reviewLines: string[] = [];
  for (const t of reviewTasks) {
    const projectName = t.project?.name ?? "Sin proyecto";
    // Disponibles para acciones (p. ej. aprobar = marcar COMPLETADO)
    taskMap.set(t.id, { id: t.id, title: t.title, projectId: t.project?.id ?? null, projectName });

    const parts: string[] = [
      `ID:${t.id}`,
      `#${t.number} "${t.title}"`,
      `Proyecto: ${projectName}`,
      `Prioridad: ${PRIORITY_LABELS[t.priority]}`,
    ];
    if (t.assignedTo?.name) parts.push(`Responsable: ${t.assignedTo.name}`);
    if (t.dueDate) parts.push(`Vence: ${fmt(t.dueDate)}${t.dueDate < now ? " (VENCIDA)" : ""}`);
    reviewLines.push(`- ${parts.join(" · ")}`);
  }

  // Tickets pendientes de revisión por este usuario (es revisor)
  const reviewTicketLines: string[] = [];
  for (const tk of reviewTickets) {
    const code = tk.prefix ? `${tk.prefix}-${tk.number}` : `#${tk.number}`;
    const parts: string[] = [`${code} "${tk.title}"`, `Prioridad: ${PRIORITY_LABELS[tk.priority]}`];
    if (tk.assignedTo?.name) parts.push(`Responsable: ${tk.assignedTo.name}`);
    if (tk.site) parts.push(`Sitio: ${tk.site.name}`);
    if (tk.dueDate) parts.push(`Vence: ${fmt(tk.dueDate)}${tk.dueDate < now ? " (VENCIDO)" : ""}`);
    reviewTicketLines.push(`- ${parts.join(" · ")}`);
  }

  const projectLines = projects.map((p) => `- ID:${p.id} · ${p.name}`);

  const contextText =
    `### Tareas activas del colaborador (${tasks.length})\n` +
    (lines.length ? lines.join("\n") : "(No tiene tareas activas asignadas.)") +
    `\n\n### Tareas pendientes de tu revisión (${reviewTasks.length})\n` +
    (reviewLines.length ? reviewLines.join("\n") : "(No tienes tareas por revisar.)") +
    `\n\n### Tickets pendientes de tu revisión (${reviewTickets.length})\n` +
    (reviewTicketLines.length ? reviewTicketLines.join("\n") : "(No tienes tickets por revisar.)") +
    `\n\n### Tickets activos asignados (${tickets.length})\n` +
    (ticketLines.length ? ticketLines.join("\n") : "(No tiene tickets activos asignados.)") +
    `\n\n### Proyectos donde puede crear tareas\n` +
    (projectLines.length ? projectLines.join("\n") : "(Sin proyectos disponibles.)");

  return { contextText, taskMap, projectMap };
}

// ─── Declaraciones de funciones (propuestas de acción) ─────────────────────────

const functionDeclarations: FunctionDeclaration[] = [
  {
    name: "cambiar_estado_tarea",
    description:
      "Propone cambiar el estado de una tarea existente del colaborador. Úsalo cuando el usuario quiera empezar, enviar a revisión o completar una tarea.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: { type: Type.STRING, description: "El ID exacto de la tarea (campo ID: del contexto)." },
        estado: {
          type: Type.STRING,
          enum: STATUS_VALUES,
          description: "Nuevo estado de la tarea.",
        },
      },
      required: ["taskId", "estado"],
    },
  },
  {
    name: "agregar_checklist",
    description:
      "Propone agregar ítems de checklist (subpasos) a una tarea existente. Úsalo para convertir un plan en pasos accionables dentro de la tarea.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        taskId: { type: Type.STRING, description: "El ID exacto de la tarea (campo ID: del contexto)." },
        items: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Lista de pasos breves y concretos a agregar como checklist.",
        },
      },
      required: ["taskId", "items"],
    },
  },
  {
    name: "crear_tarea",
    description:
      "Propone crear una nueva tarea en uno de los proyectos disponibles del colaborador. Úsalo cuando el usuario quiera registrar trabajo nuevo.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        projectId: { type: Type.STRING, description: "El ID exacto del proyecto (campo ID: del contexto de proyectos)." },
        titulo: { type: Type.STRING, description: "Título breve y claro de la tarea." },
        descripcion: { type: Type.STRING, description: "Descripción de qué hay que hacer." },
        prioridad: { type: Type.STRING, enum: PRIORITY_VALUES, description: "Prioridad de la tarea." },
      },
      required: ["projectId", "titulo", "descripcion"],
    },
  },
];

// Mismas herramientas en formato OpenAI (JSON Schema)
const OPENAI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "cambiar_estado_tarea",
      description:
        "Propone cambiar el estado de una tarea existente del colaborador (empezar, enviar a revisión o completar).",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "El ID exacto de la tarea (campo ID: del contexto)." },
          estado: { type: "string", enum: STATUS_VALUES, description: "Nuevo estado de la tarea." },
        },
        required: ["taskId", "estado"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agregar_checklist",
      description: "Propone agregar ítems de checklist (subpasos) a una tarea existente.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "El ID exacto de la tarea (campo ID: del contexto)." },
          items: { type: "array", items: { type: "string" }, description: "Pasos breves y concretos a agregar." },
        },
        required: ["taskId", "items"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crear_tarea",
      description: "Propone crear una nueva tarea en uno de los proyectos disponibles del colaborador.",
      parameters: {
        type: "object",
        properties: {
          projectId: { type: "string", description: "El ID exacto del proyecto (campo ID: del contexto de proyectos)." },
          titulo: { type: "string", description: "Título breve y claro de la tarea." },
          descripcion: { type: "string", description: "Descripción de qué hay que hacer." },
          prioridad: { type: "string", enum: PRIORITY_VALUES, description: "Prioridad de la tarea." },
        },
        required: ["projectId", "titulo", "descripcion"],
        additionalProperties: false,
      },
    },
  },
];

const SYSTEM_INSTRUCTION = `Eres el asistente de IA de Geniorama, una plataforma de gestión de tickets y proyectos. Ayudas a los colaboradores del equipo a **diagnosticar, planear y avanzar** sus tareas de proyectos.

Reglas:
- Responde SIEMPRE en español, de forma clara, concreta y práctica. Usa Markdown (encabezados, listas, negritas) cuando ayude.
- Tienes acceso al contexto con: las **tareas activas** del colaborador (con sus comentarios recientes), las **tareas pendientes de su revisión** (donde es revisor y otra persona es la responsable), los **tickets activos** que tiene asignados (con sus comentarios recientes, sitio/app afectado y descripción) y los **proyectos** donde puede crear tareas. Razona sobre prioridades, fechas de vencimiento (las marcadas "VENCIDA"/"VENCIDO" son urgentes), los comentarios (revelan bloqueos, dudas y el estado real del trabajo) y la carga de trabajo.
- Cuando el usuario pregunte qué tiene **por revisar**, usa las secciones "Tareas pendientes de tu revisión" y "Tickets pendientes de tu revisión". En las **tareas** puede, tras revisar, aprobarlas (cambiar su estado a COMPLETADO) o devolverlas (a PENDIENTE) con la función de cambio de estado; los **tickets** son de solo consulta (indícale que los revise en su detalle).
- Los comentarios marcados "[interno]" son notas privadas del equipo; puedes usarlos para diagnosticar.
- Cuando el usuario quiera aplicar un cambio concreto sobre una TAREA (cambiar su estado, agregar pasos de checklist o crear una tarea nueva), LLAMA a la función correspondiente. Esas llamadas se convierten en botones que el usuario confirma con un clic; tú NO ejecutas nada por tu cuenta y NUNCA afirmes que ya hiciste el cambio. La información de tickets es solo de consulta/diagnóstico: no hay acciones automáticas sobre tickets.
- Usa exactamente los ID (campo "ID:") del contexto para las funciones de tareas. Nunca inventes IDs. Si no encuentras la tarea o proyecto en el contexto, pídele al usuario que la especifique.
- Junto con cualquier propuesta, da una breve explicación en texto de qué propones y por qué.
- Si la pregunta es solo de diagnóstico o planificación, responde solo con texto, sin llamar funciones.`;

// ─── chatWithAssistant ─────────────────────────────────────────────────────────

export async function chatWithAssistant(
  history: ChatMessage[],
  provider: AiProvider = "gemini"
): Promise<{ reply: string; actions: ProposedAction[] } | { error: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  if (!isValidProvider(provider)) provider = "gemini";
  const cfgErr = providerConfigError(provider);
  if (cfgErr) return { error: cfgErr };

  if (!Array.isArray(history) || history.length === 0) {
    return { error: "Mensaje vacío" };
  }

  const { contextText, taskMap, projectMap } = await buildContext(session.user.id);

  // El contexto se inyecta como primer turno para anclar los datos actuales.
  const messages: ChatMsg[] = [
    { role: "user", text: `Contexto actual (${session.user.name ?? "colaborador"}):\n\n${contextText}` },
    { role: "assistant", text: "Entendido. Tengo el contexto de tus tareas y proyectos. ¿En qué te ayudo?" },
    ...history.map((m) => ({ role: m.role, text: m.text })),
  ];

  let result;
  try {
    result = await runAssistantChat({
      provider,
      system: SYSTEM_INSTRUCTION,
      messages,
      geminiTools: [{ functionDeclarations }],
      openaiTools: OPENAI_TOOLS,
    });
  } catch (err) {
    console.error(`AI error (assistant/${provider}):`, err);
    return { error: "Error al contactar el servicio de IA. Verifica la configuración." };
  }

  const reply = (result.text ?? "").trim();
  const actions = mapProposedActions(result.toolCalls, taskMap, projectMap);

  if (!reply && actions.length === 0) {
    return { reply: "No pude generar una respuesta. Intenta reformular tu mensaje.", actions: [] };
  }

  return {
    reply: reply || "Te propongo las siguientes acciones:",
    actions,
  };
}

/** Convierte las functionCall del modelo en acciones validadas contra el contexto. */
function mapProposedActions(
  calls: { name?: string; args?: Record<string, unknown> }[],
  taskMap: Map<string, TaskCtx>,
  projectMap: Map<string, string>
): ProposedAction[] {
  const out: ProposedAction[] = [];

  for (const call of calls) {
    const args = call.args ?? {};
    if (call.name === "cambiar_estado_tarea") {
      const taskId = String(args.taskId ?? "");
      const estado = String(args.estado ?? "") as TaskStatus;
      const t = taskMap.get(taskId);
      if (t && STATUS_VALUES.includes(estado)) {
        out.push({ kind: "status", taskId, taskLabel: t.title, estado });
      }
    } else if (call.name === "agregar_checklist") {
      const taskId = String(args.taskId ?? "");
      const rawItems = Array.isArray(args.items) ? args.items : [];
      const items = rawItems.map((i) => String(i).trim()).filter(Boolean).slice(0, 20);
      const t = taskMap.get(taskId);
      if (t && items.length > 0) {
        out.push({ kind: "checklist", taskId, taskLabel: t.title, items });
      }
    } else if (call.name === "crear_tarea") {
      const projectId = String(args.projectId ?? "");
      const titulo = String(args.titulo ?? "").trim();
      const descripcion = String(args.descripcion ?? "").trim();
      const prioridadRaw = String(args.prioridad ?? "MEDIA") as Priority;
      const prioridad = PRIORITY_VALUES.includes(prioridadRaw) ? prioridadRaw : "MEDIA";
      const projectName = projectMap.get(projectId);
      if (projectName && titulo) {
        out.push({
          kind: "create",
          projectId,
          projectLabel: projectName,
          titulo,
          descripcion: descripcion || titulo,
          prioridad,
        });
      }
    }
  }

  return out;
}

// ─── executeAssistantAction ────────────────────────────────────────────────────

/** Ejecuta una acción propuesta tras la confirmación del usuario. Re-valida
 *  permisos y datos contra la BD; nunca confía en lo que envía el cliente. */
export async function executeAssistantAction(
  action: ProposedAction
): Promise<{ success: true; message: string } | { error: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };
  const userId = session.user.id;

  // ── Cambiar estado ──
  if (action.kind === "status") {
    if (!STATUS_VALUES.includes(action.estado)) return { error: "Estado inválido" };
    const task = await prisma.task.findUnique({
      where: { id: action.taskId },
      select: {
        title: true, status: true, createdById: true, assignedToId: true,
        projectId: true, project: { select: { isPrivate: true } },
      },
    });
    if (!task) return { error: "Tarea no encontrada" };
    if (task.status === action.estado) return { error: "La tarea ya está en ese estado" };

    const projectIsPrivate = task.project?.isPrivate ?? false;
    const taskUrl = task.projectId
      ? `/proyectos/${task.projectId}/tareas/${action.taskId}`
      : `/tareas/${action.taskId}`;

    await prisma.task.update({
      where: { id: action.taskId },
      data: { status: action.estado },
    });

    // Replicar el comportamiento de timers de updateTaskStatus
    if (action.estado === "EN_PROGRESO" && task.status !== "EN_PROGRESO") {
      const active = await prisma.taskTimeEntry.findFirst({ where: { taskId: action.taskId, stoppedAt: null } });
      if (!active) {
        await prisma.taskTimeEntry.create({ data: { taskId: action.taskId, userId, startedAt: new Date() } });
      }
    }
    if (["EN_REVISION", "COMPLETADO"].includes(action.estado)) {
      await prisma.taskTimeEntry.updateMany({
        where: { taskId: action.taskId, stoppedAt: null },
        data: { stoppedAt: new Date() },
      });
    }

    if (!projectIsPrivate && action.estado === "EN_PROGRESO" && task.status !== "EN_PROGRESO") {
      await sendGChatNotification("task_status", "Tarea en progreso", `"${task.title}" pasó a *En progreso*`, taskUrl);
    }
    if (!projectIsPrivate && action.estado === "EN_REVISION" && task.status !== "EN_REVISION") {
      await sendGChatNotification("task_status", "Tarea en revisión", `"${task.title}" pasó a *En revisión*`, taskUrl);
    }
    if (action.estado === "COMPLETADO" && task.status !== "COMPLETADO") {
      const recipients = [task.createdById, task.assignedToId].filter(
        (id): id is string => !!id && id !== userId
      );
      for (const id of recipients) {
        await notify(id, "task_completed", "Tarea completada", `"${task.title}" marcada como completada`, taskUrl, projectIsPrivate);
      }
    }

    if (task.projectId) revalidatePath(`/proyectos/${task.projectId}`);
    revalidatePath(taskUrl);
    revalidatePath("/tareas");
    return { success: true, message: `Estado actualizado a «${STATUS_LABELS[action.estado]}».` };
  }

  // ── Agregar checklist ──
  if (action.kind === "checklist") {
    const items = action.items.map((i) => i.trim()).filter(Boolean).slice(0, 20);
    if (items.length === 0) return { error: "No hay ítems para agregar" };
    const task = await prisma.task.findUnique({
      where: { id: action.taskId },
      select: { projectId: true },
    });
    if (!task) return { error: "Tarea no encontrada" };

    const count = await prisma.taskChecklistItem.count({ where: { taskId: action.taskId } });
    await prisma.taskChecklistItem.createMany({
      data: items.map((title, i) => ({
        taskId: action.taskId,
        title,
        position: count + i,
        createdById: userId,
      })),
    });

    const taskUrl = task.projectId
      ? `/proyectos/${task.projectId}/tareas/${action.taskId}`
      : `/tareas/${action.taskId}`;
    revalidatePath(taskUrl);
    return { success: true, message: `${items.length} ${items.length === 1 ? "ítem agregado" : "ítems agregados"} al checklist.` };
  }

  // ── Crear tarea ──
  if (action.kind === "create") {
    const titulo = action.titulo.trim();
    if (!titulo) return { error: "El título es requerido" };
    if (!PRIORITY_VALUES.includes(action.prioridad)) return { error: "Prioridad inválida" };

    const project = await prisma.project.findUnique({
      where: { id: action.projectId },
      select: { id: true, name: true, isPrivate: true, isActive: true },
    });
    if (!project || !project.isActive) return { error: "Proyecto no encontrado" };

    // El colaborador queda como responsable y revisor por defecto; estado pendiente.
    const task = await prisma.$transaction(async (tx) => {
      const last = await tx.task.findFirst({
        where: { projectId: action.projectId },
        orderBy: { number: "desc" },
        select: { number: true },
      });
      return tx.task.create({
        data: {
          number: (last?.number ?? 0) + 1,
          title: titulo,
          description: action.descripcion.trim() || titulo,
          status: "PENDIENTE",
          priority: action.prioridad,
          projectId: action.projectId,
          assignedToId: userId,
          createdById: userId,
          reviewers: { connect: [{ id: userId }] },
        },
      });
    });

    const taskUrl = `/proyectos/${action.projectId}/tareas/${task.id}`;
    if (!project.isPrivate) {
      await sendGChatNotification(
        "task_new",
        "Nueva tarea",
        `"${task.title}" en ${project.name}`,
        taskUrl
      );
    }

    revalidatePath(`/proyectos/${action.projectId}`);
    revalidatePath("/tareas");
    return { success: true, message: `Tarea «${titulo}» creada en ${project.name}.` };
  }

  return { error: "Acción no reconocida" };
}
