"use server";

import { Type } from "@google/genai";
import { runStructuredJson, providerConfigError, isValidProvider, type AiProvider } from "@/lib/ai";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import { isAdmin } from "@/lib/roles";
import { notify } from "@/lib/notify";
import { sendGChatNotification } from "@/lib/gchat";
import type { Priority } from "@/generated/prisma";

const PRIORITY_VALUES: Priority[] = ["BAJA", "MEDIA", "ALTA", "CRITICA"];

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type { AiProvider } from "@/lib/ai";

export type PlannerFile = { name: string; mimeType: string; dataBase64: string };

export type PlanTask = {
  titulo: string;
  descripcion: string;
  prioridad: Priority;
  assignedToId: string | null;
  assignedToName: string | null;
  estimacionHoras: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  subtareas: string[];
};

export type PlanProject = {
  nombre: string;
  descripcion: string;
  empresaId: string | null;
  empresaNombre: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
};

export type GeneratedPlan = {
  resumen: string;
  proyecto: PlanProject | null;
  tareas: PlanTask[];
};

export type PlannerOptions = {
  canCreateProject: boolean;
  projects: { id: string; name: string }[];
  companies: { id: string; name: string }[];
  staff: { id: string; name: string; cargo: string | null; area: string | null }[];
};

export type ApplyPlanInput = {
  mode: "new" | "existing";
  projectId?: string;
  newProject?: {
    name: string;
    description: string;
    companyId: string | null;
    managerId: string | null;
    startDate: string | null;
    dueDate: string | null;
    isPrivate: boolean;
  };
  tasks: {
    titulo: string;
    descripcion: string;
    prioridad: Priority;
    assignedToId: string | null;
    estimacionHoras: number | null;
    startDate: string | null;
    dueDate: string | null;
    subtareas: string[];
  }[];
};

// ─── Opciones para la UI ───────────────────────────────────────────────────────

export async function getPlannerOptions(): Promise<PlannerOptions | { error: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };
  const admin = isAdmin(session.user.role);
  const userId = session.user.id;

  const [projects, companies, staff] = await Promise.all([
    prisma.project.findMany({
      where: admin
        ? { isActive: true }
        : {
            isActive: true,
            OR: [{ managerId: userId }, { tasks: { some: { assignedToId: userId } } }],
          },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 100,
    }),
    admin
      ? prisma.company.findMany({
          where: { isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    prisma.user.findMany({
      where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
      select: { id: true, name: true, cargo: true, area: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    canCreateProject: admin,
    projects,
    companies,
    staff: staff.map((s) => ({ id: s.id, name: s.name ?? "—", cargo: s.cargo, area: s.area })),
  };
}

// ─── Extracción de texto de archivos ───────────────────────────────────────────

async function extractFile(
  file: PlannerFile
): Promise<{ text?: string; pdfBase64?: string; error?: string }> {
  const buf = Buffer.from(file.dataBase64, "base64");
  const lower = file.name.toLowerCase();

  if (file.mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    return { pdfBase64: file.dataBase64 };
  }
  if (
    lower.endsWith(".docx") ||
    file.mimeType.includes("officedocument.wordprocessing") ||
    file.mimeType === "application/msword"
  ) {
    try {
      const mammoth = await import("mammoth");
      const extract = mammoth.extractRawText ?? mammoth.default?.extractRawText;
      const res = await extract({ buffer: buf });
      return { text: res.value };
    } catch (err) {
      console.error("mammoth error:", err);
      return { error: "No se pudo leer el archivo de Word." };
    }
  }
  // txt / md / otros → texto plano
  return { text: buf.toString("utf8") };
}

// ─── Esquema de salida estructurada ────────────────────────────────────────────

const planResponseSchema = {
  type: Type.OBJECT,
  properties: {
    resumen: { type: Type.STRING, description: "Resumen breve de lo que se planificó." },
    proyecto: {
      type: Type.OBJECT,
      nullable: true,
      description: "Datos del proyecto a crear. null si se planifica sobre un proyecto existente.",
      properties: {
        nombre: { type: Type.STRING },
        descripcion: { type: Type.STRING },
        empresaId: { type: Type.STRING, nullable: true, description: "ID de la empresa de la lista provista, o null." },
        fechaInicio: { type: Type.STRING, nullable: true, description: "Fecha ISO YYYY-MM-DD o null." },
        fechaFin: { type: Type.STRING, nullable: true, description: "Fecha ISO YYYY-MM-DD o null." },
      },
      required: ["nombre", "descripcion"],
    },
    tareas: {
      type: Type.ARRAY,
      description: "Lista de tareas derivadas del documento.",
      items: {
        type: Type.OBJECT,
        properties: {
          titulo: { type: Type.STRING },
          descripcion: { type: Type.STRING },
          prioridad: { type: Type.STRING, enum: PRIORITY_VALUES },
          responsableId: { type: Type.STRING, nullable: true, description: "ID del responsable sugerido de la lista de equipo, o null." },
          estimacionHoras: { type: Type.NUMBER, nullable: true },
          fechaInicio: { type: Type.STRING, nullable: true, description: "Fecha de inicio sugerida ISO YYYY-MM-DD o null." },
          fechaFin: { type: Type.STRING, nullable: true, description: "Fecha límite sugerida ISO YYYY-MM-DD o null." },
          subtareas: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Subtareas/pasos concretos (checklist)." },
        },
        required: ["titulo", "descripcion", "prioridad"],
      },
    },
  },
  required: ["resumen", "tareas"],
};

// ─── generatePlan ──────────────────────────────────────────────────────────────

export async function generatePlan(input: {
  text?: string;
  file?: PlannerFile;
  mode: "new" | "existing";
  projectId?: string;
  provider?: AiProvider;
}): Promise<GeneratedPlan | { error: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };
  const admin = isAdmin(session.user.role);

  if (input.mode === "new" && !admin) {
    return { error: "Solo los administradores pueden crear proyectos." };
  }

  const provider: AiProvider = isValidProvider(input.provider) ? input.provider : "gemini";
  const cfgErr = providerConfigError(provider);
  if (cfgErr) return { error: cfgErr };

  // Documento: texto pegado + archivo
  let docText = (input.text ?? "").trim();
  let pdfBase64: string | undefined;
  if (input.file) {
    const extracted = await extractFile(input.file);
    if (extracted.error) return { error: extracted.error };
    if (extracted.pdfBase64) pdfBase64 = extracted.pdfBase64;
    if (extracted.text) docText = `${docText}\n\n${extracted.text}`.trim();
  }
  if (!docText && !pdfBase64) {
    return { error: "Proporciona el texto del documento o sube un archivo." };
  }

  // Contexto: empresas (si nuevo proyecto) y equipo (para sugerir responsables)
  const [companies, staff, existingProject] = await Promise.all([
    input.mode === "new"
      ? prisma.company.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([] as { id: string; name: string }[]),
    prisma.user.findMany({
      where: { role: { in: ["ADMINISTRADOR", "COLABORADOR"] }, isActive: true },
      select: { id: true, name: true, cargo: true, area: true },
      orderBy: { name: "asc" },
    }),
    input.mode === "existing" && input.projectId
      ? prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true, name: true } })
      : Promise.resolve(null),
  ]);

  const staffMap = new Map(staff.map((s) => [s.id, s.name ?? "—"]));
  const companyMap = new Map(companies.map((c) => [c.id, c.name]));

  const teamLines = staff
    .map((s) => `- ID:${s.id} · ${s.name ?? "—"}${s.cargo ? ` (${s.cargo}${s.area ? `, ${s.area}` : ""})` : ""}`)
    .join("\n");
  const companyLines = companies.map((c) => `- ID:${c.id} · ${c.name}`).join("\n");

  const prompt = `Eres un asistente de planificación de proyectos para Geniorama. A partir del documento (notas de reunión, brief, etc.) que se incluye, **extrae un plan de trabajo accionable**.

${
  input.mode === "new"
    ? `Modo: CREAR UN PROYECTO NUEVO. Genera el objeto "proyecto" (nombre claro, descripción, y si el documento lo indica, empresa y fechas). Empresas disponibles (usa el ID exacto o null):\n${companyLines || "(ninguna)"}`
    : `Modo: AGREGAR TAREAS A UN PROYECTO EXISTENTE${existingProject ? ` ("${existingProject.name}")` : ""}. Deja "proyecto" en null.`
}

Equipo disponible para sugerir responsables (usa el ID exacto en "responsableId", o null si no hay un encargado claro):
${teamLines || "(sin equipo)"}

Instrucciones:
- Descompón el trabajo en **tareas** concretas. Cada tarea: título breve, una **descripción clara** de qué hay que hacer y por qué (1-3 frases, basada en el documento), prioridad (BAJA/MEDIA/ALTA/CRITICA) y, cuando aplique, una lista de **subtareas** (pasos del checklist).
- Sugiere un responsable (responsableId) por tarea según las menciones del documento y los cargos/áreas del equipo. Si no hay señal clara, usa null.
- Estima horas (estimacionHoras) solo si el documento da pistas; si no, null.
- Sugiere fechas (fechaInicio, fechaFin) en formato YYYY-MM-DD solo si el documento menciona plazos, hitos o un orden temporal; si no hay señal, usa null.
- No inventes IDs: usa únicamente los IDs de las listas anteriores.
- Responde SIEMPRE en español.

${docText ? `--- DOCUMENTO ---\n${docText}` : "(El documento se adjunta como archivo PDF.)"}

--- FORMATO DE SALIDA (JSON) ---
Responde ÚNICAMENTE con un objeto JSON con esta forma exacta (sin texto adicional):
{"resumen": string, "proyecto": ${
    input.mode === "new"
      ? `{"nombre": string, "descripcion": string, "empresaId": string|null, "fechaInicio": "YYYY-MM-DD"|null, "fechaFin": "YYYY-MM-DD"|null}`
      : "null"
  }, "tareas": [{"titulo": string, "descripcion": string, "prioridad": "BAJA"|"MEDIA"|"ALTA"|"CRITICA", "responsableId": string|null, "estimacionHoras": number|null, "fechaInicio": "YYYY-MM-DD"|null, "fechaFin": "YYYY-MM-DD"|null, "subtareas": string[]}]}`;

  let raw: string;
  try {
    raw = await runStructuredJson({ provider, prompt, pdfBase64, geminiResponseSchema: planResponseSchema });
  } catch (err) {
    console.error(`AI error (planner/${provider}):`, err);
    return { error: "Error al contactar el servicio de IA. Verifica la configuración." };
  }

  let parsed: {
    resumen?: string;
    proyecto?: {
      nombre?: string; descripcion?: string; empresaId?: string | null;
      fechaInicio?: string | null; fechaFin?: string | null;
    } | null;
    tareas?: {
      titulo?: string; descripcion?: string; prioridad?: string;
      responsableId?: string | null; estimacionHoras?: number | null;
      fechaInicio?: string | null; fechaFin?: string | null; subtareas?: string[];
    }[];
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "La IA devolvió un formato inesperado. Intenta de nuevo." };
  }

  // Validar/normalizar contra el contexto real
  const tareas: PlanTask[] = (parsed.tareas ?? [])
    .filter((t) => t.titulo && t.titulo.trim())
    .slice(0, 40)
    .map((t) => {
      const respId = t.responsableId && staffMap.has(t.responsableId) ? t.responsableId : null;
      const prioridad = PRIORITY_VALUES.includes(t.prioridad as Priority) ? (t.prioridad as Priority) : "MEDIA";
      return {
        titulo: t.titulo!.trim(),
        descripcion: (t.descripcion ?? "").trim() || t.titulo!.trim(),
        prioridad,
        assignedToId: respId,
        assignedToName: respId ? staffMap.get(respId) ?? null : null,
        estimacionHoras: typeof t.estimacionHoras === "number" && t.estimacionHoras > 0 ? t.estimacionHoras : null,
        fechaInicio: normalizeDate(t.fechaInicio),
        fechaFin: normalizeDate(t.fechaFin),
        subtareas: Array.isArray(t.subtareas)
          ? t.subtareas.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
          : [],
      };
    });

  let proyecto: PlanProject | null = null;
  if (input.mode === "new" && parsed.proyecto?.nombre) {
    const empId = parsed.proyecto.empresaId && companyMap.has(parsed.proyecto.empresaId) ? parsed.proyecto.empresaId : null;
    proyecto = {
      nombre: parsed.proyecto.nombre.trim(),
      descripcion: (parsed.proyecto.descripcion ?? "").trim() || parsed.proyecto.nombre.trim(),
      empresaId: empId,
      empresaNombre: empId ? companyMap.get(empId) ?? null : null,
      fechaInicio: normalizeDate(parsed.proyecto.fechaInicio),
      fechaFin: normalizeDate(parsed.proyecto.fechaFin),
    };
  }

  if (tareas.length === 0 && !proyecto) {
    return { error: "No se pudieron extraer tareas del documento. Intenta con más detalle." };
  }

  return {
    resumen: (parsed.resumen ?? "").trim() || "Plan generado a partir del documento.",
    proyecto,
    tareas,
  };
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const m = /^\d{4}-\d{2}-\d{2}/.exec(value.trim());
  return m ? m[0].slice(0, 10) : null;
}

/** Formatea una fecha sin hora en español. Usa UTC para no desfasar el día
 *  (las fechas se guardan como medianoche UTC). */
function fmtDate(d: Date): string {
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}

// ─── applyPlan ─────────────────────────────────────────────────────────────────

export async function applyPlan(
  input: ApplyPlanInput
): Promise<{ success: true; projectId: string; createdCount: number; message: string } | { error: string }> {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };
  const admin = isAdmin(session.user.role);
  const userId = session.user.id;

  const tasks = (input.tasks ?? []).filter((t) => t.titulo && t.titulo.trim());
  if (tasks.length === 0) return { error: "No hay tareas para crear." };

  // Determinar proyecto destino
  let projectId: string;
  let projectName: string;
  let projectIsPrivate: boolean;

  if (input.mode === "new") {
    if (!admin) return { error: "Solo los administradores pueden crear proyectos." };
    const np = input.newProject;
    if (!np || !np.name?.trim()) return { error: "El nombre del proyecto es requerido." };

    // Validar empresa y manager si se enviaron
    if (np.companyId) {
      const c = await prisma.company.findUnique({ where: { id: np.companyId }, select: { id: true } });
      if (!c) return { error: "La empresa seleccionada no existe." };
    }
    if (np.managerId) {
      const m = await prisma.user.findUnique({ where: { id: np.managerId, isActive: true }, select: { id: true } });
      if (!m) return { error: "El encargado seleccionado no existe." };
    }

    const project = await prisma.project.create({
      data: {
        name: np.name.trim(),
        description: np.description?.trim() || np.name.trim(),
        status: "PLANIFICACION",
        companyId: np.companyId ?? null,
        managerId: np.managerId ?? null,
        createdById: userId,
        startDate: np.startDate ? new Date(np.startDate) : null,
        dueDate: np.dueDate ? new Date(np.dueDate) : null,
        isPrivate: !!np.isPrivate,
      },
      select: { id: true, name: true, isPrivate: true },
    });
    projectId = project.id;
    projectName = project.name;
    projectIsPrivate = project.isPrivate;
  } else {
    if (!input.projectId) return { error: "Selecciona un proyecto." };
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true, name: true, isPrivate: true, isActive: true },
    });
    if (!project || !project.isActive) return { error: "Proyecto no encontrado." };
    projectId = project.id;
    projectName = project.name;
    projectIsPrivate = project.isPrivate;
  }

  // Validar responsables (staff activo) y obtener sus nombres
  const requestedAssignees = [...new Set(tasks.map((t) => t.assignedToId).filter((id): id is string => !!id))];
  const assigneeNames = new Map<string, string>(
    requestedAssignees.length > 0
      ? (
          await prisma.user.findMany({
            where: { id: { in: requestedAssignees }, isActive: true, role: { in: ["ADMINISTRADOR", "COLABORADOR"] } },
            select: { id: true, name: true },
          })
        ).map((u) => [u.id, u.name ?? "—"] as const)
      : []
  );
  const validAssignees = new Set(assigneeNames.keys());

  // Crear tareas + subtareas en una transacción
  type CreatedTask = { id: string; title: string; assignedToId: string | null; dueDate: Date | null };
  const created: CreatedTask[] = [];
  const assigneeCounts = new Map<string, number>();
  await prisma.$transaction(async (tx) => {
    const last = await tx.task.findFirst({
      where: { projectId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    let nextNumber = (last?.number ?? 0) + 1;

    for (const t of tasks) {
      const assignedToId = t.assignedToId && validAssignees.has(t.assignedToId) ? t.assignedToId : null;
      const prioridad = PRIORITY_VALUES.includes(t.prioridad) ? t.prioridad : "MEDIA";
      const dueDate = t.dueDate ? new Date(t.dueDate) : null;

      const row = await tx.task.create({
        data: {
          number: nextNumber++,
          title: t.titulo.trim(),
          description: t.descripcion?.trim() || t.titulo.trim(),
          status: "PENDIENTE",
          priority: prioridad,
          projectId,
          assignedToId,
          createdById: userId,
          estimatedHours: typeof t.estimacionHoras === "number" && t.estimacionHoras > 0 ? t.estimacionHoras : null,
          startDate: t.startDate ? new Date(t.startDate) : null,
          dueDate,
          reviewers: { connect: [{ id: userId }] },
        },
        select: { id: true },
      });

      const subs = (t.subtareas ?? []).map((s) => s.trim()).filter(Boolean).slice(0, 20);
      if (subs.length > 0) {
        await tx.taskChecklistItem.createMany({
          data: subs.map((title, i) => ({ taskId: row.id, title, position: i, createdById: userId })),
        });
      }

      created.push({ id: row.id, title: t.titulo.trim(), assignedToId, dueDate });
      if (assignedToId && assignedToId !== userId) {
        assigneeCounts.set(assignedToId, (assigneeCounts.get(assignedToId) ?? 0) + 1);
      }
    }
  });

  // Webhook (Google Chat): notificar CADA tarea de forma individual, con
  // responsable y fecha de vencimiento, igual que el alta normal de tareas.
  if (!projectIsPrivate) {
    for (const t of created) {
      const parts: string[] = [`"${t.title}" en ${projectName}`];
      if (t.assignedToId) parts.push(`Asignado a: ${assigneeNames.get(t.assignedToId) ?? "—"}`);
      if (t.dueDate) parts.push(`Vence: ${fmtDate(t.dueDate)}`);
      await sendGChatNotification(
        "task_new",
        "Nueva tarea",
        parts.join(" · "),
        `/proyectos/${projectId}/tareas/${t.id}`
      );
    }
  }

  // Notificación in-app resumida por responsable (skipGChat: el webhook ya
  // recibió cada tarea individualmente, evitamos duplicar mensajes en GChat).
  for (const [assignee, count] of assigneeCounts) {
    await notify(
      assignee,
      "task_assigned",
      "Tareas asignadas",
      `Se te asignaron ${count} ${count === 1 ? "tarea" : "tareas"} en ${projectName}`,
      `/proyectos/${projectId}`,
      true
    );
  }

  revalidatePath(`/proyectos/${projectId}`);
  revalidatePath("/proyectos");
  revalidatePath("/tareas");
  return {
    success: true,
    projectId,
    createdCount: tasks.length,
    message: `${tasks.length} ${tasks.length === 1 ? "tarea creada" : "tareas creadas"} en ${projectName}.`,
  };
}
