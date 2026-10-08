"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import {
  asegurarLinkDePago, iniciarPago, motivoNoPagable, pasarelaLista, urlDePago,
  TIPOS_DOCUMENTO, type InicioDePago,
} from "@/lib/billing/paylink";
import { apuntarEnCobro } from "@/lib/billing/items";

/** Genera (o recupera) el link de pago de un cobro. */
export async function generatePayLink(billingItemId: string) {
  const session = await requireCan("FACTURACION", "editar");

  if (!pasarelaLista()) return { error: "El pago en línea no está configurado en el servidor" };

  const cobro = await prisma.billingItem.findUnique({
    where: { id: billingItemId },
    select: { status: true, amount: true, paidAmount: true, payToken: true },
  });
  if (!cobro) return { error: "Cobro no encontrado" };

  const motivo = motivoNoPagable(cobro);
  if (motivo) return { error: motivo };

  const token = await asegurarLinkDePago(billingItemId);
  if (!token) return { error: "No se pudo generar el link" };

  if (!cobro.payToken) {
    await apuntarEnCobro(billingItemId, "billing.pay_link_created", session.user);
  }

  revalidatePath(`/facturacion/${billingItemId}`);
  return { success: true, url: urlDePago(token) };
}

const pagadorSchema = z.object({
  firstName: z.string().trim().min(1, "Escribe tu nombre").max(80),
  lastName: z.string().trim().min(1, "Escribe tu apellido").max(80),
  email: z.string().trim().email("Ese correo no es válido").max(160),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => /^\+?\d{7,15}$/.test(v), "Ese teléfono no es válido"),
  docType: z.enum(TIPOS_DOCUMENTO),
  docNumber: z
    .string()
    .trim()
    .refine((v) => v.replace(/\D/g, "").length >= 5, "Ese número de documento no es válido"),
});

/**
 * Lo que pulsa quien paga. **Sin sesión**: la página es pública y lo único que
 * la protege es la llave del link. Por eso no recibe importe ni id de cobro:
 * todo sale del cobro al que apunta la llave.
 */
export async function startPayment(token: string, datos: unknown): Promise<InicioDePago> {
  if (typeof token !== "string" || token.length < 20 || token.length > 80) {
    return { ok: false, error: "Este link de pago no existe" };
  }
  const parsed = pagadorSchema.safeParse(datos);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  return iniciarPago(token, parsed.data);
}
