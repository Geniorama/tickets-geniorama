import type { BillingEmailStatus } from "@/generated/prisma";

/**
 * Cómo se llaman y de qué color van los estados de un correo.
 *
 * Aparte de `send.ts` por lo mismo que las etiquetas de los canales: el
 * navegador solo necesita la palabra, no el cliente de correo.
 */
export const EMAIL_STATUS_LABELS: Record<BillingEmailStatus, string> = {
  PROGRAMADO: "PROGRAMADO",
  ENVIANDO:   "SALIENDO",
  ENVIADO:    "ENVIADO",
  FALLIDO:    "FALLÓ",
  CANCELADO:  "CANCELADO",
  OMITIDO:    "NO SALIÓ",
};

export const EMAIL_STATUS_COLORS: Record<BillingEmailStatus, string> = {
  PROGRAMADO: "#3b82f6",
  ENVIANDO:   "#f59e0b",
  ENVIADO:    "#22c55e",
  FALLIDO:    "#dc2626",
  CANCELADO:  "#94a3b8",
  OMITIDO:    "#f59e0b",
};
