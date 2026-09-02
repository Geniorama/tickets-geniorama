/**
 * Qué acciones se guardan en el historial, y cómo se leen.
 *
 * Vive en código por el mismo motivo que el catálogo de hooks: añadir una
 * acción es una línea aquí más la llamada a `recordActivity()` donde ocurra, no
 * una migración. La pantalla de /admin/actividad se arma leyendo este archivo,
 * así que una acción nueva aparece sola en el selector.
 *
 * El vocabulario es el de los hooks —`recurso.acción`, en inglés y en pasado—
 * porque muchas acciones son literalmente el mismo hecho contado dos veces: una
 * hacia afuera y otra hacia adentro. Este catálogo es el superconjunto: incluye
 * además lo que no sale de la plataforma (facturación y administración).
 *
 * La etiqueta se escribe en tercera persona sin sujeto («creó el ticket»),
 * porque delante siempre va el nombre de quien lo hizo.
 */

import type { EntityType } from "@/generated/prisma";

// ─── Módulos ─────────────────────────────────────────────────────────────────

/** Cómo se agrupa el historial en el filtro del listado global. */
export const ACTIVITY_MODULES = [
  "tickets",
  "tareas",
  "proyectos",
  "facturacion",
  "crm",
  "admin",
] as const;

export type ActivityModule = (typeof ACTIVITY_MODULES)[number];

export const MODULE_LABELS: Record<ActivityModule, string> = {
  tickets: "Tickets",
  tareas: "Tareas",
  proyectos: "Proyectos",
  facturacion: "Facturación",
  crm: "CRM",
  admin: "Administración",
};

/**
 * El módulo se deduce de la entidad, no se guarda.
 *
 * Guardarlo obligaría a rellenarlo en cada llamada y abriría la puerta a que
 * una entrada dijera que un ticket es de facturación. La entidad ya lo sabe.
 */
export const MODULE_OF_ENTITY: Record<EntityType, ActivityModule> = {
  TICKET: "tickets",
  TASK: "tareas",
  PROJECT: "proyectos",
  BILLING: "facturacion",
  BILLING_PAYMENT: "facturacion",
  COMPANY: "crm",
  CONTACT: "crm",
  DEAL: "crm",
  USER: "admin",
  VAULT_ENTRY: "admin",
  SITE: "admin",
  PLAN: "admin",
  SERVICE: "admin",
  INTEGRATION: "admin",
  SETTINGS: "admin",
};

/** Cómo se llama una ficha de cada tipo, para las frases del listado global. */
export const ENTITY_LABELS: Record<EntityType, string> = {
  TICKET: "ticket",
  TASK: "tarea",
  PROJECT: "proyecto",
  BILLING: "cobro",
  BILLING_PAYMENT: "abono",
  COMPANY: "empresa",
  CONTACT: "contacto",
  DEAL: "oportunidad",
  USER: "usuario",
  VAULT_ENTRY: "credencial",
  SITE: "sitio",
  PLAN: "plan",
  SERVICE: "servicio",
  INTEGRATION: "integración",
  SETTINGS: "ajuste",
};

/**
 * A dónde lleva el enlace de una entrada, o null si la ficha no se abre sola.
 *
 * Un abono no tiene página propia: se ve dentro de su cobro, así que su enlace
 * lo pone quien registra la acción vía `meta.href`.
 */
export function entityHref(entityType: EntityType, entityId: string): string | null {
  switch (entityType) {
    case "TICKET":      return `/tickets/${entityId}`;
    case "TASK":        return `/tareas/${entityId}`;
    case "PROJECT":     return `/proyectos/${entityId}`;
    case "BILLING":     return `/facturacion/${entityId}`;
    case "COMPANY":     return `/crm/${entityId}`;
    case "DEAL":        return `/crm/oportunidades/${entityId}`;
    case "CONTACT":     return `/crm/contactos`;
    case "VAULT_ENTRY": return `/boveda/${entityId}`;
    case "SITE":        return `/admin/sitios/${entityId}/edit`;
    case "PLAN":        return `/admin/plans/${entityId}/edit`;
    case "USER":        return `/admin/users`;
    case "SERVICE":     return `/admin/servicios`;
    case "INTEGRATION": return `/admin/integraciones`;
    default:            return null;
  }
}

/**
 * La «ficha» de lo que no tiene ficha.
 *
 * Un hook o una llave de API no son algo que nadie abra por separado: se
 * gestionan todos juntos en /admin/integraciones, y su historial se entiende
 * ahí, en una sola línea de tiempo. Lo mismo vale para los ajustes globales.
 * Este es el `entityId` que comparten, para que el panel los recoja de una.
 */
export const PLATFORM_SCOPE = "platform";

// ─── Campos ──────────────────────────────────────────────────────────────────

/**
 * Cómo se lee el antes/después de un campo.
 *
 * El tipo decide el formato al mostrar, no al guardar: así arreglar cómo se
 * escribe un importe arregla también el historial viejo. La excepción es
 * `user`, que se resuelve al escribir (ver `record.ts`): un id de usuario ya no
 * significa nada si esa persona desaparece.
 */
export type FieldKind = "text" | "status" | "priority" | "money" | "date" | "bool" | "user" | "list";

export type FieldSpec = {
  label: string;
  kind: FieldKind;
  /**
   * Cómo se dice `false` y `true` en este campo concreto.
   *
   * «Cambió la privacidad de no a sí» no lo entiende nadie; «pasó de público a
   * privado», sí. Solo aplica a `kind: "bool"`.
   */
  boolLabels?: [string, string];
};

/**
 * Los campos cuyo antes/después merece guardarse.
 *
 * Es una lista corta a propósito: es la diferencia entre un historial que se
 * lee y un volcado de columnas. La descripción de un ticket no está aquí —que
 * cambió se registra, pero el texto entero no cabe en una línea de historial ni
 * ayuda a auditar nada.
 */
export const FIELDS: Record<string, FieldSpec> = {
  // Comunes
  title:          { label: "el título",           kind: "text" },
  name:           { label: "el nombre",           kind: "text" },
  status:         { label: "el estado",           kind: "status" },
  priority:       { label: "la prioridad",        kind: "priority" },
  dueDate:        { label: "la fecha límite",     kind: "date" },
  startDate:      { label: "la fecha de inicio",  kind: "date" },
  endDate:        { label: "la fecha de fin",     kind: "date" },
  assignedToId:   { label: "el responsable",      kind: "user" },
  reviewers:      { label: "los revisores",       kind: "list" },
  category:       { label: "la categoría",        kind: "text" },
  isPrivate:      { label: "la privacidad",       kind: "bool", boolLabels: ["público", "privado"] },
  estimatedHours: { label: "las horas estimadas", kind: "text" },

  // Facturación
  amount:      { label: "el importe",             kind: "money" },
  concept:     { label: "el concepto",            kind: "text" },
  issueDate:   { label: "la fecha de emisión",    kind: "date" },
  paidAt:      { label: "la fecha de pago",       kind: "date" },
  method:      { label: "el medio de pago",       kind: "text" },
  reference:   { label: "la referencia",          kind: "text" },
  ownerId:     { label: "el responsable",         kind: "user" },
  labels:      { label: "las etiquetas",          kind: "list" },

  // CRM
  stage:       { label: "la etapa",               kind: "status" },
  expectedCloseAt: { label: "la fecha de cierre", kind: "date" },
  source:      { label: "el origen",              kind: "text" },
  taxId:       { label: "el NIT",                 kind: "text" },
  lostReason:  { label: "el motivo de pérdida",   kind: "text" },
  isPrimary:   { label: "el contacto principal",  kind: "bool", boolLabels: ["secundario", "principal"] },

  // Administración
  role:        { label: "el rol",                 kind: "text" },
  email:       { label: "el correo",              kind: "text" },
  isActive:    { label: "el estado de la cuenta", kind: "bool", boolLabels: ["inactiva", "activa"] },
  profile:     { label: "el perfil de acceso",    kind: "text" },
  access:      { label: "los permisos",           kind: "list" },
  domain:      { label: "el dominio",             kind: "text" },
  plan:        { label: "el plan",                kind: "text" },
  url:         { label: "la URL",                 kind: "text" },
  events:      { label: "los eventos suscritos",  kind: "list" },
  scopes:      { label: "los permisos de la llave", kind: "list" },
};

export function fieldSpec(key: string): FieldSpec {
  return FIELDS[key] ?? { label: `«${key}»`, kind: "text" };
}

/** Los campos de cada entidad cuyo cambio vale la pena guardar. */
export const TRACKED_FIELDS: Partial<Record<EntityType, string[]>> = {
  TICKET:  ["title", "status", "priority", "dueDate", "assignedToId", "reviewers", "category", "estimatedHours"],
  TASK:    ["title", "status", "priority", "dueDate", "startDate", "assignedToId", "reviewers", "category", "estimatedHours"],
  PROJECT: ["name", "status", "startDate", "dueDate", "isPrivate"],
  BILLING: ["concept", "amount", "status", "dueDate", "issueDate", "ownerId", "category", "labels"],
  COMPANY: ["name", "taxId", "stage", "source", "ownerId"],
  CONTACT: ["name", "email", "isPrimary"],
  DEAL:    ["title", "stage", "amount", "expectedCloseAt", "ownerId", "lostReason"],
  USER:    ["name", "email", "role", "isActive", "profile", "access"],
};

// ─── Acciones ────────────────────────────────────────────────────────────────

export type ActivityAction = {
  key: string;
  /** Sobre qué ficha se registra. Solo informativo: lo real lo pone la llamada. */
  entity: EntityType;
  /** Tercera persona, sin sujeto: delante va el nombre de quien lo hizo. */
  label: string;
  /**
   * Cómo se pinta en la línea de tiempo.
   * `create` verde, `update` neutro, `destroy` rojo, `move` ámbar (cambios de
   * estado y de etapa, que es lo que más se busca al auditar).
   */
  tone: "create" | "update" | "move" | "destroy";
};

export const ACTIVITY_ACTIONS: readonly ActivityAction[] = [
  // ── Tickets ──
  { key: "ticket.created",           entity: "TICKET", label: "creó el ticket",              tone: "create" },
  { key: "ticket.updated",           entity: "TICKET", label: "editó el ticket",             tone: "update" },
  { key: "ticket.status_changed",    entity: "TICKET", label: "cambió el estado",            tone: "move" },
  { key: "ticket.assigned",          entity: "TICKET", label: "cambió el responsable",       tone: "update" },
  { key: "ticket.deleted",           entity: "TICKET", label: "eliminó el ticket",           tone: "destroy" },

  // ── Tickets recurrentes ──
  //
  // Se registran sobre TICKET con el id de la plantilla: no son un módulo
  // aparte, son la programación de un ticket. Como esa ficha no vive en
  // /tickets/<id>, cada entrada lleva su propio enlace en `meta.href`.
  { key: "ticket.recurrence_created", entity: "TICKET", label: "programó un ticket recurrente", tone: "create" },
  { key: "ticket.recurrence_updated", entity: "TICKET", label: "editó una recurrencia",         tone: "update" },
  { key: "ticket.recurrence_paused",  entity: "TICKET", label: "pausó una recurrencia",         tone: "move" },
  { key: "ticket.recurrence_resumed", entity: "TICKET", label: "reanudó una recurrencia",       tone: "move" },
  { key: "ticket.recurrence_deleted", entity: "TICKET", label: "eliminó una recurrencia",       tone: "destroy" },

  // ── Tareas ──
  { key: "task.created",             entity: "TASK", label: "creó la tarea",                 tone: "create" },
  { key: "task.updated",             entity: "TASK", label: "editó la tarea",                tone: "update" },
  { key: "task.status_changed",      entity: "TASK", label: "cambió el estado",              tone: "move" },
  { key: "task.assigned",            entity: "TASK", label: "cambió el responsable",         tone: "update" },
  { key: "task.completed",           entity: "TASK", label: "completó la tarea",             tone: "create" },
  { key: "task.deleted",             entity: "TASK", label: "eliminó la tarea",              tone: "destroy" },

  // ── Proyectos ──
  { key: "project.created",          entity: "PROJECT", label: "creó el proyecto",           tone: "create" },
  { key: "project.updated",          entity: "PROJECT", label: "editó el proyecto",          tone: "update" },
  { key: "project.status_changed",   entity: "PROJECT", label: "cambió el estado",           tone: "move" },
  { key: "project.members_changed",  entity: "PROJECT", label: "cambió el equipo",           tone: "update" },
  { key: "project.deleted",          entity: "PROJECT", label: "eliminó el proyecto",        tone: "destroy" },

  // ── Núcleo compartido: cae sobre la ficha donde ocurrió ──
  { key: "comment.created",          entity: "TICKET", label: "comentó",                     tone: "update" },
  { key: "comment.deleted",          entity: "TICKET", label: "borró un comentario",         tone: "destroy" },
  { key: "attachment.added",         entity: "TICKET", label: "adjuntó un archivo",          tone: "update" },
  { key: "attachment.removed",       entity: "TICKET", label: "quitó un adjunto",            tone: "destroy" },

  // ── Facturación ──
  { key: "billing.created",          entity: "BILLING", label: "creó el cobro",              tone: "create" },
  { key: "billing.updated",          entity: "BILLING", label: "editó el cobro",             tone: "update" },
  { key: "billing.status_changed",   entity: "BILLING", label: "cambió el estado del cobro", tone: "move" },
  { key: "billing.deleted",          entity: "BILLING", label: "eliminó el cobro",           tone: "destroy" },
  { key: "billing.payment_added",    entity: "BILLING", label: "registró un abono",          tone: "create" },
  { key: "billing.payment_updated",  entity: "BILLING", label: "corrigió un abono",          tone: "update" },
  { key: "billing.payment_deleted",  entity: "BILLING", label: "eliminó un abono",           tone: "destroy" },
  { key: "billing.receipt_added",    entity: "BILLING", label: "subió un comprobante",       tone: "update" },
  { key: "billing.receipt_deleted",  entity: "BILLING", label: "borró un comprobante",       tone: "destroy" },
  { key: "billing.labels_changed",   entity: "BILLING", label: "cambió las etiquetas",       tone: "update" },
  { key: "billing.reminder_sent",    entity: "BILLING", label: "envió un recordatorio",      tone: "update" },

  // ── CRM ──
  { key: "account.created",          entity: "COMPANY", label: "creó la empresa",            tone: "create" },
  { key: "account.updated",          entity: "COMPANY", label: "editó la empresa",           tone: "update" },
  { key: "account.stage_changed",    entity: "COMPANY", label: "cambió la etapa",            tone: "move" },
  { key: "account.deleted",          entity: "COMPANY", label: "eliminó la empresa",         tone: "destroy" },
  { key: "contact.created",          entity: "CONTACT", label: "añadió el contacto",         tone: "create" },
  { key: "contact.updated",          entity: "CONTACT", label: "editó el contacto",          tone: "update" },
  { key: "contact.deleted",          entity: "CONTACT", label: "eliminó el contacto",        tone: "destroy" },
  { key: "deal.created",             entity: "DEAL", label: "abrió la oportunidad",          tone: "create" },
  { key: "deal.updated",             entity: "DEAL", label: "editó la oportunidad",          tone: "update" },
  { key: "deal.stage_changed",       entity: "DEAL", label: "movió la oportunidad",          tone: "move" },
  { key: "deal.won",                 entity: "DEAL", label: "ganó la oportunidad",           tone: "create" },
  { key: "deal.lost",                entity: "DEAL", label: "perdió la oportunidad",         tone: "destroy" },
  { key: "deal.deleted",             entity: "DEAL", label: "eliminó la oportunidad",        tone: "destroy" },
  { key: "activity.logged",          entity: "COMPANY", label: "registró una interacción",   tone: "update" },

  // ── Administración · usuarios y permisos ──
  { key: "user.created",             entity: "USER", label: "creó el usuario",               tone: "create" },
  { key: "user.updated",             entity: "USER", label: "editó el usuario",              tone: "update" },
  { key: "user.role_changed",        entity: "USER", label: "cambió el rol",                 tone: "move" },
  { key: "user.access_changed",      entity: "USER", label: "cambió los permisos",           tone: "move" },
  { key: "user.activated",           entity: "USER", label: "reactivó la cuenta",            tone: "create" },
  { key: "user.deactivated",         entity: "USER", label: "desactivó la cuenta",           tone: "destroy" },
  { key: "user.password_reset",      entity: "USER", label: "restableció la contraseña",     tone: "move" },
  { key: "user.invited",             entity: "USER", label: "invitó al usuario",             tone: "create" },
  { key: "user.deleted",             entity: "USER", label: "eliminó el usuario",            tone: "destroy" },

  // ── Administración · bóveda ──
  //
  // `vault.revealed` es la razón de ser de auditar la bóveda: no importa tanto
  // quién editó una credencial como quién la miró.
  { key: "vault.created",            entity: "VAULT_ENTRY", label: "guardó la credencial",   tone: "create" },
  { key: "vault.updated",            entity: "VAULT_ENTRY", label: "editó la credencial",    tone: "update" },
  { key: "vault.revealed",           entity: "VAULT_ENTRY", label: "consultó la credencial", tone: "move" },
  { key: "vault.shared",             entity: "VAULT_ENTRY", label: "cambió con quién se comparte", tone: "move" },
  { key: "vault.deleted",            entity: "VAULT_ENTRY", label: "eliminó la credencial",  tone: "destroy" },

  // ── Administración · catálogos ──
  { key: "site.created",             entity: "SITE", label: "creó el sitio",                 tone: "create" },
  { key: "site.updated",             entity: "SITE", label: "editó el sitio",                tone: "update" },
  { key: "site.deleted",             entity: "SITE", label: "eliminó el sitio",              tone: "destroy" },
  { key: "plan.created",             entity: "PLAN", label: "creó el plan",                  tone: "create" },
  { key: "plan.updated",             entity: "PLAN", label: "editó el plan",                 tone: "update" },
  { key: "plan.deleted",             entity: "PLAN", label: "eliminó el plan",               tone: "destroy" },
  { key: "service.created",          entity: "SERVICE", label: "creó el servicio",           tone: "create" },
  { key: "service.updated",          entity: "SERVICE", label: "editó el servicio",          tone: "update" },
  { key: "service.deleted",          entity: "SERVICE", label: "eliminó el servicio",        tone: "destroy" },

  // ── Administración · integraciones ──
  { key: "integration.hook_created", entity: "INTEGRATION", label: "creó un hook",           tone: "create" },
  { key: "integration.hook_updated", entity: "INTEGRATION", label: "editó un hook",          tone: "update" },
  { key: "integration.hook_deleted", entity: "INTEGRATION", label: "eliminó un hook",        tone: "destroy" },
  { key: "integration.key_created",  entity: "INTEGRATION", label: "creó una llave de API",  tone: "create" },
  { key: "integration.key_revoked",  entity: "INTEGRATION", label: "revocó una llave de API", tone: "destroy" },
  { key: "integration.connected",    entity: "INTEGRATION", label: "conectó la integración", tone: "create" },
  { key: "integration.synced",       entity: "INTEGRATION", label: "sincronizó",             tone: "update" },
  { key: "settings.updated",         entity: "SETTINGS", label: "cambió los ajustes",        tone: "update" },
] as const;

const BY_KEY = new Map(ACTIVITY_ACTIONS.map((a) => [a.key, a]));

/**
 * La acción, o un respaldo legible si alguien registró una que no está aquí.
 *
 * Se degrada en vez de fallar: una entrada de historial con nombre feo es mejor
 * que una pantalla en blanco, y los registros viejos deben seguir leyéndose
 * aunque una acción se retire del catálogo.
 */
export function actionSpec(key: string): ActivityAction {
  const known = BY_KEY.get(key);
  if (known) return known;
  return { key, entity: "TICKET", label: key.replace(/[._]/g, " "), tone: "update" };
}

export function isActivityAction(key: string): boolean {
  return BY_KEY.has(key);
}

/** Las acciones de un módulo, para el selector del listado global. */
export function actionsOfModule(module: ActivityModule): ActivityAction[] {
  return ACTIVITY_ACTIONS.filter((a) => MODULE_OF_ENTITY[a.entity] === module);
}

/** Los tipos de entidad que caen dentro de un módulo. */
export function entitiesOfModule(module: ActivityModule): EntityType[] {
  return (Object.keys(MODULE_OF_ENTITY) as EntityType[]).filter(
    (e) => MODULE_OF_ENTITY[e] === module,
  );
}
