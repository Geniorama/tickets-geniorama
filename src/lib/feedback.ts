/**
 * Buzón de feedback (AG·P-1): etiquetas y límites, sin nada del servidor para
 * que el botón del navegador y la pantalla de administración compartan archivo.
 */

export const FEEDBACK_TYPES = ["ERROR", "IDEA", "CONFUSO", "OTRO"] as const;
export type FeedbackTypeKey = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_STATUSES = ["NUEVO", "EN_REVISION", "CONVERTIDO", "DESCARTADO"] as const;
export type FeedbackStatusKey = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackTypeKey, string> = {
  ERROR: "Error",
  IDEA: "Idea",
  CONFUSO: "Algo confuso",
  OTRO: "Otro",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatusKey, string> = {
  NUEVO: "Nuevo",
  EN_REVISION: "En revisión",
  CONVERTIDO: "Convertido en tarea",
  DESCARTADO: "Descartado",
};

export const FEEDBACK_MAX_MESSAGE = 4000;
export const FEEDBACK_MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const FEEDBACK_SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function isFeedbackType(v: unknown): v is FeedbackTypeKey {
  return typeof v === "string" && (FEEDBACK_TYPES as readonly string[]).includes(v);
}

export function isFeedbackStatus(v: unknown): v is FeedbackStatusKey {
  return typeof v === "string" && (FEEDBACK_STATUSES as readonly string[]).includes(v);
}
