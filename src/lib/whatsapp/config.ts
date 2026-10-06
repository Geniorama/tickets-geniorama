/**
 * Catálogo de avisos que salen por WhatsApp, sin nada del servidor: lo leen
 * también las pantallas de configuración.
 *
 * WhatsApp no deja mandar texto libre a quien no ha escrito en las últimas 24
 * horas: cada aviso sale con una **plantilla aprobada por Meta**. Por eso aquí
 * no hay un «manda cualquier notificación», sino una lista corta de tipos, cada
 * uno con su plantilla. Lo que no está en la lista no sale por WhatsApp.
 *
 * Todas las plantillas usan las mismas tres variables, para que dar de alta una
 * nueva no obligue a tocar código:
 *
 *   · `nombre`  — nombre de pila de quien lo recibe
 *   · `detalle` — qué pasó, en una frase (el mismo texto de la campana)
 *   · `enlace`  — URL completa para abrirlo en la plataforma
 *
 * Meta no acepta plantillas que empiecen o terminen en una variable; por eso
 * todas cierran con una firma fija.
 *
 * La clave de cada plantilla (la que da Zoho CPaaS al crearla) se guarda en
 * ajustes desde Administración → Integraciones. Un tipo sin clave no se envía.
 */

import type { NotificationCategory } from "@/lib/notification-categories";

export const WHATSAPP_MERGE_KEYS = ["nombre", "detalle", "enlace"] as const;

/** Ajuste con el número emisor (el de la cuenta de WhatsApp Business). */
export const WHATSAPP_FROM_KEY = "whatsapp_from";

export type WhatsAppEvent = {
  /** `type` de la notificación, tal como llega a `notify()`. */
  type: string;
  /** Ajuste donde se guarda la clave de la plantilla. */
  settingKey: string;
  label: string;
  audience: "Equipo" | "Clientes" | "Equipo y clientes";
  category: NotificationCategory;
  /** Nombre sugerido al registrar la plantilla (minúsculas y guiones bajos, como pide Meta). */
  templateName: string;
  /** Texto sugerido. Categoría «Utilidad», idioma español. */
  templateBody: string;
};

export const WHATSAPP_EVENTS: WhatsAppEvent[] = [
  {
    type: "mention",
    settingKey: "whatsapp_tpl_mention",
    label: "Mención en un comentario",
    audience: "Equipo y clientes",
    category: "mentions",
    templateName: "geniorama_mencion",
    templateBody:
      "Hola {{nombre}}, te mencionaron en Geniorama. {{detalle}}\n\nÁbrelo aquí: {{enlace}}\n\nEquipo Geniorama",
  },
  {
    type: "task_assigned",
    settingKey: "whatsapp_tpl_task_assigned",
    label: "Tarea asignada",
    audience: "Equipo",
    category: "tasks",
    templateName: "geniorama_tarea_asignada",
    templateBody:
      "Hola {{nombre}}, tienes una tarea nueva en Geniorama. {{detalle}}\n\nVer la tarea: {{enlace}}\n\nEquipo Geniorama",
  },
  {
    type: "ticket_assigned",
    settingKey: "whatsapp_tpl_ticket_assigned",
    label: "Ticket asignado a ti",
    audience: "Equipo",
    category: "tickets",
    templateName: "geniorama_ticket_asignado",
    templateBody:
      "Hola {{nombre}}, tienes un ticket de soporte a tu cargo. {{detalle}}\n\nVer el ticket: {{enlace}}\n\nEquipo Geniorama",
  },
  {
    type: "ticket_new",
    settingKey: "whatsapp_tpl_ticket_new",
    label: "Ticket nuevo de un cliente",
    audience: "Equipo",
    category: "tickets",
    templateName: "geniorama_ticket_nuevo",
    templateBody:
      "Hola {{nombre}}, entró un ticket nuevo que está sin asignar. {{detalle}}\n\nRevisarlo: {{enlace}}\n\nEquipo Geniorama",
  },
  {
    type: "ticket_agent_assigned",
    settingKey: "whatsapp_tpl_ticket_agent_assigned",
    label: "Tu ticket ya tiene un agente",
    audience: "Clientes",
    category: "tickets",
    templateName: "geniorama_ticket_en_atencion",
    templateBody:
      "Hola {{nombre}}, tu solicitud de soporte ya tiene un agente asignado. {{detalle}}\n\nPuedes seguirla aquí: {{enlace}}\n\nEquipo Geniorama",
  },
  {
    type: "ticket_status",
    settingKey: "whatsapp_tpl_ticket_status",
    label: "Cambio de estado de un ticket",
    audience: "Equipo y clientes",
    category: "tickets",
    templateName: "geniorama_ticket_estado",
    templateBody:
      "Hola {{nombre}}, hay una actualización en un ticket de soporte. {{detalle}}\n\nVer el ticket: {{enlace}}\n\nEquipo Geniorama",
  },
  {
    type: "ticket_comment",
    settingKey: "whatsapp_tpl_ticket_comment",
    label: "Respuesta en un ticket",
    audience: "Equipo y clientes",
    category: "comments",
    templateName: "geniorama_ticket_respuesta",
    templateBody:
      "Hola {{nombre}}, hay una respuesta nueva en un ticket de soporte. {{detalle}}\n\nLeerla y responder: {{enlace}}\n\nEquipo Geniorama",
  },
];

export const WHATSAPP_EVENT_BY_TYPE = new Map(WHATSAPP_EVENTS.map((e) => [e.type, e]));

/** Todos los ajustes que usa WhatsApp, para leerlos de una vez. */
export const WHATSAPP_SETTING_KEYS = [WHATSAPP_FROM_KEY, ...WHATSAPP_EVENTS.map((e) => e.settingKey)];
