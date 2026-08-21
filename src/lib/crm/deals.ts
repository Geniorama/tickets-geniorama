import type { DealStage, ActivityType } from "@/generated/prisma";

/**
 * Oportunidades: lo que se está vendiendo a una cuenta.
 *
 * La cuenta responde «con quién hablamos» y su etapa es el estado de la
 * relación; la oportunidad responde «qué le estamos vendiendo y por cuánto».
 * Son cosas distintas a propósito: un cliente de años puede tener una
 * oportunidad nueva abierta sin dejar de ser cliente.
 */

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  NUEVA:       "Nueva",
  CONTACTADA:  "Contactada",
  PROPUESTA:   "Propuesta",
  NEGOCIACION: "Negociación",
  GANADA:      "Ganada",
  PERDIDA:     "Perdida",
};

export const DEAL_STAGE_DESCRIPTIONS: Record<DealStage, string> = {
  NUEVA:       "Detectada, sin contactar todavía.",
  CONTACTADA:  "Ya hubo conversación y hay interés.",
  PROPUESTA:   "Propuesta enviada, esperando respuesta.",
  NEGOCIACION: "Se está ajustando alcance o precio.",
  GANADA:      "Cerrada a favor.",
  PERDIDA:     "Cerrada sin venta.",
};

export const DEAL_STAGE_COLORS: Record<DealStage, string> = {
  NUEVA:       "#64748b",
  CONTACTADA:  "#3b82f6",
  PROPUESTA:   "#8b5cf6",
  NEGOCIACION: "#f59e0b",
  GANADA:      "#22c55e",
  PERDIDA:     "#ef4444",
};

export const DEAL_STAGES: DealStage[] = [
  "NUEVA", "CONTACTADA", "PROPUESTA", "NEGOCIACION", "GANADA", "PERDIDA",
];

/**
 * Etapas terminales. Al entrar en una se sella `closedAt`; al salir se borra,
 * porque una oportunidad reabierta vuelve a estar en curso.
 */
export const CLOSED_STAGES: DealStage[] = ["GANADA", "PERDIDA"];

export const isClosedStage = (stage: DealStage) => CLOSED_STAGES.includes(stage);

/** Las que siguen vivas: lo que de verdad es «el pipeline». */
export const OPEN_STAGES: DealStage[] = DEAL_STAGES.filter((s) => !isClosedStage(s));

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  NOTA:     "Nota",
  LLAMADA:  "Llamada",
  CORREO:   "Correo",
  REUNION:  "Reunión",
  WHATSAPP: "WhatsApp",
};

export const ACTIVITY_TYPES: ActivityType[] = [
  "NOTA", "LLAMADA", "CORREO", "REUNION", "WHATSAPP",
];

/**
 * Los importes se muestran sin decimales: en una propuesta comercial los
 * centavos son ruido, y la columna del tablero es estrecha.
 */
export function formatAmount(amount: number | null | undefined): string | null {
  if (amount === null || amount === undefined) return null;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(amount);
}
