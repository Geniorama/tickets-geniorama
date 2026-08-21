/**
 * Catálogo de eventos que la plataforma cuenta hacia afuera.
 *
 * Vive en código y no en la base a propósito: añadir un evento es una línea
 * aquí más la llamada a `emitHook()` donde ocurra, no una migración. La
 * pantalla de hooks se arma leyendo este archivo, así que un evento nuevo
 * aparece solo en el selector.
 *
 * El nombre es siempre `recurso.acción`, en inglés y en pasado. Es la convención
 * que esperan n8n, Zapier y Make, y evita tener que traducir en cada workflow.
 */

export const HOOK_RESOURCES = [
  "ticket", "task", "project", "comment",
  "account", "contact", "deal", "activity",
] as const;
export type HookResource = (typeof HOOK_RESOURCES)[number];

export type HookEventDefinition = {
  key: string;
  resource: HookResource;
  label: string;
  description: string;
};

export const HOOK_EVENTS: readonly HookEventDefinition[] = [
  // ── Tickets ──
  { key: "ticket.created",        resource: "ticket",  label: "Ticket creado",            description: "Alguien abrió un ticket (incluye los que entran por la API)." },
  { key: "ticket.updated",        resource: "ticket",  label: "Ticket editado",           description: "Cambió el título, la descripción, la prioridad o las fechas." },
  { key: "ticket.status_changed", resource: "ticket",  label: "Ticket cambió de estado",  description: "Pasó a otro estado. El payload trae el estado anterior." },
  { key: "ticket.assigned",       resource: "ticket",  label: "Ticket asignado",          description: "Cambió el responsable del ticket." },
  { key: "ticket.deleted",        resource: "ticket",  label: "Ticket eliminado",         description: "Se borró el ticket." },

  // ── Tareas ──
  { key: "task.created",          resource: "task",    label: "Tarea creada",             description: "Se creó una tarea (no se avisa de los borradores)." },
  { key: "task.updated",          resource: "task",    label: "Tarea editada",            description: "Cambió el contenido, la prioridad o las fechas." },
  { key: "task.status_changed",   resource: "task",    label: "Tarea cambió de estado",   description: "Pasó a otro estado. El payload trae el estado anterior." },
  { key: "task.assigned",         resource: "task",    label: "Tarea asignada",           description: "Cambió el responsable de la tarea." },
  { key: "task.completed",        resource: "task",    label: "Tarea completada",         description: "Pasó a Completado. Llega además del cambio de estado." },
  { key: "task.deleted",          resource: "task",    label: "Tarea eliminada",          description: "Se borró la tarea." },

  // ── Proyectos ──
  { key: "project.created",        resource: "project", label: "Proyecto creado",          description: "Se creó un proyecto." },
  { key: "project.updated",        resource: "project", label: "Proyecto editado",         description: "Cambiaron sus datos, sus fechas o sus miembros." },
  { key: "project.status_changed", resource: "project", label: "Proyecto cambió de estado", description: "Pasó a otro estado. El payload trae el estado anterior." },
  { key: "project.deleted",        resource: "project", label: "Proyecto eliminado",       description: "Se borró el proyecto y todo lo que colgaba de él." },

  // ── Comentarios ──
  { key: "comment.created",        resource: "comment", label: "Comentario nuevo",         description: "Alguien comentó en un ticket o en una tarea. Las notas internas no salen." },

  // ── CRM · Cuentas ──
  { key: "account.created",        resource: "account", label: "Cuenta creada",            description: "Se registró una empresa en el CRM, sea lead o cliente." },
  { key: "account.updated",        resource: "account", label: "Cuenta editada",           description: "Cambiaron sus datos comerciales: responsable, origen, NIT." },
  { key: "account.stage_changed",  resource: "account", label: "Cuenta cambió de etapa",   description: "Pasó a otra etapa del ciclo. El payload trae la anterior — aquí es donde se detecta que un lead se volvió cliente." },

  // ── CRM · Contactos ──
  { key: "contact.created",        resource: "contact", label: "Contacto creado",          description: "Se añadió una persona a una cuenta." },
  { key: "contact.updated",        resource: "contact", label: "Contacto editado",         description: "Cambiaron sus datos o pasó a ser el contacto principal." },
  { key: "contact.deleted",        resource: "contact", label: "Contacto eliminado",       description: "Se quitó la persona de la cuenta." },

  // ── CRM · Oportunidades ──
  { key: "deal.created",           resource: "deal",    label: "Oportunidad creada",       description: "Se abrió una venta sobre una cuenta." },
  { key: "deal.updated",           resource: "deal",    label: "Oportunidad editada",      description: "Cambió el título, el valor, la fecha de cierre o el responsable." },
  { key: "deal.stage_changed",     resource: "deal",    label: "Oportunidad cambió de etapa", description: "Se movió en el pipeline. El payload trae la etapa anterior." },
  { key: "deal.won",               resource: "deal",    label: "Oportunidad ganada",       description: "Se cerró a favor. Llega además del cambio de etapa: es el evento que se quiere enganchar a facturación o a un canal de avisos." },
  { key: "deal.lost",              resource: "deal",    label: "Oportunidad perdida",      description: "Se cerró sin venta. El payload trae el motivo." },
  { key: "deal.deleted",           resource: "deal",    label: "Oportunidad eliminada",    description: "Se borró la oportunidad y su historial." },

  // ── CRM · Actividad ──
  { key: "activity.logged",        resource: "activity", label: "Actividad registrada",    description: "Se apuntó una llamada, un correo, una reunión o una nota sobre una cuenta." },
] as const;

export type HookEvent = (typeof HOOK_EVENTS)[number]["key"];

export const HOOK_EVENT_KEYS: string[] = HOOK_EVENTS.map((e) => e.key);

const EVENT_SET = new Set(HOOK_EVENT_KEYS);

export function isHookEvent(value: string): value is HookEvent {
  return EVENT_SET.has(value);
}

export const RESOURCE_LABELS: Record<HookResource, string> = {
  ticket: "Tickets",
  task: "Tareas",
  project: "Proyectos",
  comment: "Comentarios",
  account: "CRM · Cuentas",
  contact: "CRM · Contactos",
  deal: "CRM · Oportunidades",
  activity: "CRM · Actividad",
};

/** Lo que pertenece al CRM, que no cuelga de ningún proyecto. */
const CRM_RESOURCES: HookResource[] = ["account", "contact", "deal", "activity"];

/**
 * Eventos que tiene sentido suscribir en un hook de proyecto.
 *
 * Los tickets no cuelgan de un proyecto —son soporte, viven contra un plan y un
 * sitio—, así que un hook de proyecto nunca los recibiría y ofrecerlos en su
 * selector solo generaría hooks mudos. Lo mismo vale para el CRM: una
 * oportunidad es de una empresa, no de un proyecto.
 */
export const PROJECT_SCOPED_EVENTS: string[] = HOOK_EVENTS.filter(
  (e) => e.resource !== "ticket" && !CRM_RESOURCES.includes(e.resource),
).map((e) => e.key);

/** Los eventos que un hook puede pedir según su alcance. */
export function allowedEventsFor(scope: "ORG" | "PROJECT"): string[] {
  return scope === "PROJECT" ? PROJECT_SCOPED_EVENTS : HOOK_EVENT_KEYS;
}
