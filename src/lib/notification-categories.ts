// Categorías de notificación usadas por los webhooks personales.
// Cada notificación (`type`) pertenece a exactamente una categoría.

export type NotificationCategory = "tickets" | "tasks" | "comments" | "mentions";

export const NOTIFICATION_CATEGORIES: {
  key: NotificationCategory;
  label: string;
  description: string;
}[] = [
  { key: "tickets",  label: "Tickets",     description: "Tickets nuevos, asignaciones, cambios de estado y vencimientos." },
  { key: "tasks",    label: "Tareas",      description: "Tareas nuevas, asignaciones, cambios de estado, completadas y vencimientos." },
  { key: "comments", label: "Comentarios", description: "Comentarios nuevos en tus tickets y tareas." },
  { key: "mentions", label: "Menciones",   description: "Cuando alguien te menciona con @ en un comentario." },
];

export const NOTIFICATION_CATEGORY_KEYS: NotificationCategory[] =
  NOTIFICATION_CATEGORIES.map((c) => c.key);

/** Devuelve la categoría de un tipo de notificación, o null si no se reconoce. */
export function notificationCategory(type: string): NotificationCategory | null {
  if (type === "mention") return "mentions";
  if (type === "ticket_comment" || type === "task_comment") return "comments";
  if (type.startsWith("ticket_")) return "tickets";
  if (type.startsWith("task_")) return "tasks";
  return null;
}
