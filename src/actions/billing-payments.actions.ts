"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCan } from "@/lib/access/can";
import { parseAmount } from "@/lib/money";
import { registrarPago, borrarPago } from "@/lib/billing/payments";

/**
 * Los abonos de un cobro.
 *
 * La lógica vive en `lib/billing/payments.ts` para poder probarla sin sesión.
 * Aquí solo el guardia, la validación de lo que llega del navegador y el
 * refresco de las pantallas que muestran dinero.
 */

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

  const crudo = String(formData.get("paidOn") ?? "").trim();
  const parsed = pagoSchema.safeParse({
    amount: parseAmount(formData.get("amount")) ?? 0,
    // Mediodía y no medianoche: con husos por medio, una fecha a las 00:00 se
    // guarda como el día anterior y el abono aparece con fecha equivocada.
    paidOn: crudo ? new Date(`${crudo}T12:00:00`) : undefined,
    method: String(formData.get("method") ?? "").trim() || undefined,
    note: String(formData.get("note") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const r = await registrarPago(billingItemId, parsed.data, session.user.id);
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
