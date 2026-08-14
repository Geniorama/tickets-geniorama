"use server";

/**
 * Generador de plantillas con IA.
 *
 * No escribe nada en base de datos: devuelve un borrador que el formulario de
 * plantillas prellena. Quien crea la plantilla revisa y ajusta antes de guardar,
 * así que la IA propone pero nunca decide.
 */

import { Type } from "@google/genai";
import { can } from "@/lib/access/can";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import {
  isValidProvider,
  providerConfigError,
  runStructuredJson,
  type AiProvider,
} from "@/lib/ai";
import { normalizeChecklistGroups, type ChecklistGroup } from "@/lib/checklist";
import { TASK_CATEGORIES } from "@/lib/task-categories";
import { TICKET_CATEGORIES } from "@/lib/ticket-categories";
import type { Priority } from "@/generated/prisma";

export type TemplateKind = "TASK" | "TICKET";

export type TemplateDraft = {
  name: string;
  title: string;
  description: string;
  priority: Priority;
  category: string | null;
  /** Horas decimales. Solo se rellena en plantillas de tarea. */
  estimatedHours: number | null;
  checklist: ChecklistGroup[];
};

const PRIORITY_VALUES: Priority[] = ["BAJA", "MEDIA", "ALTA", "CRITICA"];

const MAX_PROMPT_LENGTH = 2000;
const MAX_CHECKLIST_GROUPS = 4;
const MAX_CHECKLIST_ITEMS = 15;

// ─── Esquema de salida estructurada ───────────────────────────────────────────

function responseSchema(kind: TemplateKind, categories: string[]) {
  const properties: Record<string, unknown> = {
    nombre: { type: Type.STRING, description: "Nombre corto de la plantilla (máx. 120 caracteres)." },
    titulo: {
      type: Type.STRING,
      description: `Título que tendrá ${kind === "TASK" ? "la tarea" : "el ticket"} creado a partir de la plantilla (máx. 200 caracteres).`,
    },
    descripcion: { type: Type.STRING, description: "Descripción en Markdown, entre 2 y 8 líneas." },
    prioridad: { type: Type.STRING, enum: PRIORITY_VALUES },
    categoria: {
      type: Type.STRING,
      nullable: true,
      enum: categories,
      description: "Una de las categorías disponibles, o null si ninguna encaja.",
    },
    checklist: {
      type: Type.ARRAY,
      description: "Grupos de checklist con los pasos concretos del trabajo.",
      items: {
        type: Type.OBJECT,
        properties: {
          titulo: { type: Type.STRING, description: "Nombre del checklist (p. ej. «Preparación»)." },
          items: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Pasos accionables, en imperativo." },
        },
        required: ["titulo", "items"],
      },
    },
  };

  if (kind === "TASK") {
    properties.estimacionHoras = {
      type: Type.NUMBER,
      nullable: true,
      description: "Tiempo estimado en horas decimales (0.5 = 30 min), o null si no hay base para estimar.",
    };
  }

  return {
    type: Type.OBJECT,
    properties,
    required: ["nombre", "titulo", "descripcion", "prioridad", "checklist"],
  };
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(kind: TemplateKind, userPrompt: string, categories: string[]): string {
  const entity = kind === "TASK" ? "tareas" : "tickets";
  const entitySingular = kind === "TASK" ? "la tarea" : "el ticket";

  return `Eres un asistente que diseña **plantillas reutilizables de ${entity}** para Geniorama, una agencia de marketing digital y desarrollo web.

A partir de la petición del usuario, genera una plantilla lista para usar. Recuerda que una plantilla se reutiliza muchas veces con clientes y fechas distintas: **no inventes nombres de cliente, fechas ni datos concretos**. Cuando haga falta un dato variable, usa un marcador entre corchetes: [Cliente], [Mes], [Campaña], [Dominio].

Campos a generar:
- **nombre**: cómo se llamará la plantilla en el listado. Corto y reconocible (p. ej. «Publicación de Instagram»).
- **titulo**: el título con el que nacerá ${entitySingular}. Puede incluir marcadores.
- **descripcion**: Markdown breve y accionable — qué hay que hacer, qué se entrega y qué hace falta para empezar. Usa viñetas o **negritas** si aportan. Nada de relleno.
- **prioridad**: BAJA, MEDIA, ALTA o CRITICA. Usa MEDIA salvo que la petición justifique otra.
- **categoria**: elige exactamente una de esta lista, o null si ninguna encaja:
${categories.map((c) => `  - ${c}`).join("\n")}
${kind === "TASK" ? "- **estimacionHoras**: horas decimales para un caso típico (1.5 = 1h 30m). Sé realista; usa null si no hay forma de estimar.\n" : ""}- **checklist**: de 1 a ${MAX_CHECKLIST_GROUPS} grupos. Cada grupo con un título y entre 3 y ${MAX_CHECKLIST_ITEMS} pasos concretos, en imperativo, en el orden en que se ejecutan. Si el trabajo tiene fases claras (preparación, ejecución, cierre), usa un grupo por fase; si no, un solo grupo basta.

Responde SIEMPRE en español.

--- PETICIÓN DEL USUARIO ---
${userPrompt}

--- FORMATO DE SALIDA (JSON) ---
Responde ÚNICAMENTE con un objeto JSON con esta forma exacta, sin texto adicional:
{"nombre": string, "titulo": string, "descripcion": string, "prioridad": "BAJA"|"MEDIA"|"ALTA"|"CRITICA", "categoria": string|null${kind === "TASK" ? ', "estimacionHoras": number|null' : ""}, "checklist": [{"titulo": string, "items": string[]}]}`;
}

// ─── Acción ───────────────────────────────────────────────────────────────────

export async function generateTemplateDraft(input: {
  kind: TemplateKind;
  prompt: string;
  provider?: AiProvider;
}): Promise<TemplateDraft | { error: string }> {
  const session = await getRequiredSession();

  // Los mismos permisos que exige crear la plantilla a mano.
  const allowed =
    input.kind === "TASK"
      ? await can(session.user, "PROYECTOS", "crear")
      : isStaff(session.user.role);
  if (!allowed) return { error: "Sin permisos" };

  const userPrompt = (input.prompt ?? "").trim().slice(0, MAX_PROMPT_LENGTH);
  if (!userPrompt) return { error: "Describe qué plantilla necesitas." };

  const provider: AiProvider = isValidProvider(input.provider) ? input.provider : "gemini";
  const cfgErr = providerConfigError(provider);
  if (cfgErr) return { error: cfgErr };

  const categories = input.kind === "TASK" ? TASK_CATEGORIES : TICKET_CATEGORIES;

  let raw: string;
  try {
    raw = await runStructuredJson({
      provider,
      prompt: buildPrompt(input.kind, userPrompt, categories),
      geminiResponseSchema: responseSchema(input.kind, categories),
    });
  } catch (err) {
    console.error(`AI error (plantillas/${provider}):`, err);
    return { error: "Error al contactar el servicio de IA. Verifica la configuración." };
  }

  let parsed: {
    nombre?: string;
    titulo?: string;
    descripcion?: string;
    prioridad?: string;
    categoria?: string | null;
    estimacionHoras?: number | null;
    checklist?: { titulo?: string; items?: string[] }[];
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { error: "La IA devolvió un formato inesperado. Intenta de nuevo." };
  }

  const name = (parsed.nombre ?? "").trim();
  const title = (parsed.titulo ?? "").trim() || name;
  const description = (parsed.descripcion ?? "").trim();
  if (!name || !title || !description) {
    return { error: "La IA no devolvió una plantilla completa. Intenta con una descripción más concreta." };
  }

  // La categoría solo se acepta si existe de verdad en el selector.
  const category =
    typeof parsed.categoria === "string" && categories.includes(parsed.categoria)
      ? parsed.categoria
      : null;

  const checklist = normalizeChecklistGroups(
    (parsed.checklist ?? []).slice(0, MAX_CHECKLIST_GROUPS).map((g) => ({
      title: g.titulo,
      items: (g.items ?? []).slice(0, MAX_CHECKLIST_ITEMS),
    })),
  );

  const hours = parsed.estimacionHoras;
  const estimatedHours =
    input.kind === "TASK" && typeof hours === "number" && hours > 0 && hours < 1000
      ? Math.round(hours * 60) / 60
      : null;

  return {
    name: name.slice(0, 120),
    title: title.slice(0, 200),
    description,
    priority: PRIORITY_VALUES.includes(parsed.prioridad as Priority)
      ? (parsed.prioridad as Priority)
      : "MEDIA",
    category,
    estimatedHours,
    checklist,
  };
}
