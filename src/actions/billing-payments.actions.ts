"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCan } from "@/lib/access/can";
import { parseAmount } from "@/lib/money";
import { registrarPago, actualizarPago, borrarPago } from "@/lib/billing/payments";

/**
 * Los abonos de un cobro.
 *
 * La lógica vive en `lib/billing/payments.ts` para poder probarla sin sesión.
 * Aquí solo el guardia, la validación de lo que llega del navegador y el
 * refresco de las pantallas que muestran dinero.
 */

// Mediodía y no medianoche al leer la fecha: con husos por medio, una fecha a
// las 00:00 se guarda como el día anterior y el abono aparece con fecha
// equivocada.
const pagoSchema = z.object({
  amount: z.number().positive("El abono tiene que ser mayor que cero"),
  paidOn: z.date({ message: "Falta la fecha del abono" }),
  method: z.string().max(80).optional(),
  note: z.string().max(500).optional(),
});

function refrescar(billingItemId: string) {
  revalidatePath(`/facturacion/${billingItemId}`);
  // El tablero no se revalida aquí: se renderiza en cada visita, así que ya
  // trae los importes al día. Pedirlo además era la única diferencia con el
  // panel de novedades, que sí se refrescaba solo.
}

export async function addBillingPayment(billingItemId: string, formData: FormData) {
  const session = await requireCan("FACTURACION", "editar");

  const parsed = leerPago(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const r = await registrarPago(billingItemId, parsed.data, session.user.id);
  if (!r.ok) return { error: r.error };

  refrescar(billingItemId);
  return { success: true };
}

/** Lee el formulario de un abono, que es el mismo al crear y al corregir. */
function leerPago(formData: FormData) {
  const crudo = String(formData.get("paidOn") ?? "").trim();
  return pagoSchema.safeParse({
    amount: parseAmount(formData.get("amount")) ?? 0,
    paidOn: crudo ? new Date(`${crudo}T12:00:00`) : undefined,
    method: String(formData.get("method") ?? "").trim() || undefined,
    note: String(formData.get("note") ?? "").trim() || undefined,
  });
}

/**
 * Corregir un abono pide lo mismo que apuntarlo.
 *
 * Podría parecer que tocar una cifra ya guardada merece más permiso que
 * escribirla, pero quien puede editar ya cambia el total del cobro entero, que
 * es un número más gordo. Exigir más aquí solo conseguiría que un importe mal
 * tecleado se quedara mal.
 */
export async function updateBillingPayment(
  pagoId: string,
  billingItemId: string,
  formData: FormData,
) {
  await requireCan("FACTURACION", "editar");

  const parsed = leerPago(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const r = await actualizarPago(pagoId, billingItemId, parsed.data);
  if (!r.ok) return { error: r.error };

  refrescar(billingItemId);
  return { success: true };
}

export async function deleteBillingPayment(pagoId: string, billingItemId: string) {
  // Quitar un abono cambia lo cobrado y puede devolver el cobro a «Facturado»:
  // pide GESTOR, como borrar el cobro entero.
  await requireCan("FACTURACION", "gestionar");

  const r = await borrarPago(pagoId, billingItemId);
  if (!r.ok) return { error: r.error };

  refrescar(billingItemId);
  return { success: true };
}
