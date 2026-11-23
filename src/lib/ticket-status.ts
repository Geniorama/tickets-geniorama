/**
 * Reglas de los estados de ticket que no son «trabajo en curso».
 *
 * - **Cerrado** y **Anulado** son finales: el ticket ya no está abierto. Se
 *   distinguen porque uno se resolvió y el otro se canceló, y los reportes no
 *   deben contarlos igual.
 * - **En espera del cliente** no es final, pero tampoco es trabajo del equipo:
 *   no cuenta como vencido ni como inactivo mientras el cliente no responda.
 * - Esos dos estados piden un **motivo**, que se guarda en `statusReason` y se
 *   vacía al salir de ellos.
 */

import type { TicketStatus } from "@/generated/prisma";

/** El ticket ya no está abierto. */
export const ESTADOS_FINALES: TicketStatus[] = ["CERRADO", "ANULADO"];

/** Bloqueado por un tercero: ni vence ni se alerta por inactividad. */
export const ESTADOS_EN_PAUSA: TicketStatus[] = ["ESPERA_CLIENTE"];

/** Estados que exigen explicar por qué se llegó a ellos. */
export const ESTADOS_CON_MOTIVO: TicketStatus[] = ["ESPERA_CLIENTE", "ANULADO"];

export const MOTIVO_MAX = 500;

export function esFinal(status: string): boolean {
  return (ESTADOS_FINALES as string[]).includes(status);
}

export function requiereMotivo(status: string): boolean {
  return (ESTADOS_CON_MOTIVO as string[]).includes(status);
}

/**
 * Qué guardar en `statusReason` al pasar de `from` a `to`.
 *
 * - `{ value: string }`: guardar ese motivo.
 * - `{ value: null }`: vaciarlo (el estado nuevo no lleva motivo).
 * - `{ value: undefined }`: dejarlo como está (sigue en el mismo estado y no se
 *   envió uno nuevo).
 * - `{ error }`: falta el motivo obligatorio.
 */
export function resolverMotivo(
  to: string,
  from: string | null | undefined,
  reason: string | null | undefined,
): { value: string | null | undefined } | { error: string } {
  if (!requiereMotivo(to)) return { value: null };

  const texto = reason?.trim();
  if (texto) return { value: texto.slice(0, MOTIVO_MAX) };
  if (from === to) return { value: undefined };

  return {
    error:
      to === "ESPERA_CLIENTE"
        ? "Indica qué se espera del cliente para pasar a «En espera del cliente»."
        : "Indica el motivo para anular el ticket.",
  };
}
