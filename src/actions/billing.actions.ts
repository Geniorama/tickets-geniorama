"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import { deleteCommentsFor } from "@/lib/comments";
import { deleteAttachmentsFor } from "@/lib/attachments";
import type { BillingStatus } from "@/generated/prisma";
import { BILLING_STATUSES } from "@/lib/billing/status";
import { moveBillingStatus } from "@/lib/billing/move";
import { parseAmount } from "@/lib/money";
import { actualizarCobro, crearCobro } from "@/lib/billing/items";
import { recordActivity } from "@/lib/activity/record";
import { entityLabel } from "@/lib/activity/label";

const estados = BILLING_STATUSES as [BillingStatus, ...BillingStatus[]];

const lineaSchema = z.object({
  // Holgado a propósito: el concepto de una línea es lo que verá el cliente en
  // la factura, y ahí caben dos frases explicando qué se hizo.
  concept: z.string().min(1, "Cada línea necesita un concepto").max(2000),
  amount:  z.number().positive("El importe de cada línea debe ser mayor que cero"),
  // Cero es exento. Se acota para que nadie mande un 900 % desde el cliente.
  taxRate: z.number().min(0).max(100),
  // Opcional: hay cobros anteriores a las categorías, y no se obliga a
  // inventar una para poder guardar.
  categoryId: z.string().nullable(),
});

const cobroSchema = z.object({
  concept:   z.string().min(1, "Escribe qué se cobra").max(200),
  companyId: z.string().min(1, "La empresa es requerida"),
  status:    z.enum(estados).default("BACKLOG"),
  lines:     z.array(lineaSchema).min(1, "Añade al menos una línea"),
  dueDate:   z.date().nullable(),
  invoiceDueDate: z.date().nullable(),
  invoiceNumber: z.string().max(60).optional(),
  ownerId:   z.string().optional(),
  notes:     z.string().max(4000).optional(),
});

function parseDate(raw: FormDataEntryValue | null): Date | null {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Las líneas viajan como JSON en un campo oculto: son una lista de longitud
 * variable, y nombrarlas `linea[0][importe]` obliga a reconstruir el array a
 * mano en el servidor.
 */
function leerLineas(raw: FormDataEntryValue | null): unknown {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((l: { concept?: unknown; amount?: unknown; taxRate?: unknown; categoryId?: unknown }) => ({
      concept: String(l?.concept ?? "").trim(),
      amount: parseAmount(l?.amount) ?? 0,
      taxRate: Number(l?.taxRate ?? 0),
      categoryId: l?.categoryId ? String(l.categoryId) : null,
    }));
  } catch {
    return [];
  }
}

function leer(formData: FormData) {
  return cobroSchema.safeParse({
    concept:   formData.get("concept"),
    companyId: formData.get("companyId"),
    status:    formData.get("status") || "BACKLOG",
    lines:     leerLineas(formData.get("lines")),
    dueDate:   parseDate(formData.get("dueDate")),
    invoiceDueDate: parseDate(formData.get("invoiceDueDate")),
    invoiceNumber: formData.get("invoiceNumber") || undefined,
    ownerId:   formData.get("ownerId") || undefined,
    notes:     formData.get("notes") || undefined,
  });
}

export async function createBillingItem(formData: FormData) {
  const session = await requireCan("FACTURACION", "crear");

  const parsed = leer(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // La lógica vive en lib/billing/items: el asistente (MCP) guarda igual
  const r = await crearCobro(session.user, parsed.data);
  if (!r.ok) return { error: r.error };

  revalidatePath("/facturacion");
  redirect(`/facturacion/${r.id}`);
}

export async function updateBillingItem(id: string, formData: FormData) {
  const session = await requireCan("FACTURACION", "editar");

  const parsed = leer(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const r = await actualizarCobro(session.user, id, parsed.data);
  if (!r.ok) return { error: r.error };

  revalidatePath("/facturacion");
  revalidatePath(`/facturacion/${id}`);
  return { success: true };
}

/**
 * Duplica un cobro: misma empresa, líneas, etiquetas, responsable y notas, pero
 * como cobro nuevo en Backlog. No se copia nada que sea del hecho y no del
 * molde: ni la factura, ni los abonos, ni el link de pago, ni las novedades.
 */
export async function duplicateBillingItem(id: string) {
  const session = await requireCan("FACTURACION", "crear");

  const origen = await prisma.billingItem.findUnique({
    where: { id },
    select: {
      concept: true, companyId: true, dueDate: true, ownerId: true, notes: true,
      labels: { select: { id: true } },
      lines: {
        orderBy: { position: "asc" },
        select: { concept: true, amount: true, taxRate: true, categoryId: true },
      },
    },
  });
  if (!origen) return { error: "Cobro no encontrado" };
  if (origen.lines.length === 0) return { error: "El cobro no tiene líneas que copiar" };

  const r = await crearCobro(session.user, {
    concept: `Copia ${origen.concept}`.slice(0, 200),
    companyId: origen.companyId,
    status: "BACKLOG",
    lines: origen.lines,
    dueDate: origen.dueDate,
    invoiceDueDate: null,
    ownerId: origen.ownerId ?? undefined,
    notes: origen.notes ?? undefined,
  });
  if (!r.ok) return { error: r.error };

  if (origen.labels.length > 0) {
    await prisma.billingItem.update({
      where: { id: r.id },
      data: { labels: { connect: origen.labels.map((l) => ({ id: l.id })) } },
    });
  }

  revalidatePath("/facturacion");
  return { ok: true as const, id: r.id };
}

/**
 * Mueve un cobro de estado. Es lo que se hace arrastrando en el tablero.
 *
 * Ya no recibe un importe: soltar en «Abonado» abre el formulario de abonos,
 * que es donde se dice cuánto entró y cuándo. Aquí solo se mueve la tarjeta.
 */
export async function setBillingStatus(id: string, status: BillingStatus, invoiceNumber?: string) {
  const session = await requireCan("FACTURACION", "editar");

  const r = await moveBillingStatus(id, status, session.user, invoiceNumber);
  if (!r.ok) return { error: r.error };

  revalidatePath("/facturacion");
  revalidatePath(`/facturacion/${id}`);
  return { success: true };
}

/**
 * Mueve varios cobros de golpe a otra columna (la acción «Mover todas»).
 *
 * Cada uno pasa por `moveBillingStatus`, así que se aplican las mismas reglas
 * que al arrastrar: los que no pueden ir —sin número de factura para
 * «Facturado», con abonos hacia atrás, al archivo sin estar pagados— se saltan
 * y se cuentan, en vez de abortar todo el lote. «Abonado» queda fuera: pide
 * cuánto entró en cada cobro y no se puede deducir en masa.
 */
export async function moveBillingItems(ids: string[], status: BillingStatus) {
  const session = await requireCan("FACTURACION", "editar");

  if (!BILLING_STATUSES.includes(status)) return { error: "Estado no válido" };
  if (status === "ABONADO") return { error: "A «Abonado» no se mueve en bloque: cada cobro necesita su abono." };
  const unicos = [...new Set(ids)].slice(0, 500);
  if (unicos.length === 0) return { error: "No hay cobros que mover" };

  let movidos = 0;
  const fallos = new Map<string, number>();
  for (const id of unicos) {
    const r = await moveBillingStatus(id, status, session.user);
    if (r.ok) movidos++;
    else fallos.set(r.error, (fallos.get(r.error) ?? 0) + 1);
  }

  revalidatePath("/facturacion");
  return {
    ok: true as const,
    movidos,
    omitidos: unicos.length - movidos,
    motivos: [...fallos].map(([error, n]) => `${n} · ${error}`),
  };
}

/**
 * Borra un cobro.
 *
 * `volverAlListado` distingue quién llama: desde la ficha hay que salir de una
 * página que ya no existe; desde el tablero no, y redirigir allí además tiraría
 * los filtros que lleve puestos la URL.
 */
export async function deleteBillingItem(id: string, volverAlListado = true) {
  // Borrar un cobro borra el rastro de un dinero: pide GESTOR.
  const session = await requireCan("FACTURACION", "gestionar");

  const cobro = await prisma.billingItem.findUnique({ where: { id }, select: { id: true } });
  if (!cobro) return { error: "Cobro no encontrado" };

  // El nombre se toma antes de borrar: después no hay cobro que consultar, y
  // «quién borró el cobro de Acme» es justo lo que se le pregunta al historial.
  const etiqueta = await entityLabel("BILLING", id);

  // Los abonos sí caen por clave foránea, pero sus comprobantes no: viven en la
  // tabla compartida. Hay que recogerlos antes de que desaparezcan los abonos,
  // o quedan huérfanos sin forma de encontrarlos.
  const abonos = await prisma.billingPayment.findMany({
    where: { billingItemId: id },
    select: { id: true },
  });

  // Novedades y soportes polimórficos: sin cascada en la base, se borran aquí.
  // Mismo criterio que tareas y tickets.
  await prisma.$transaction(async (tx) => {
    await deleteCommentsFor("BILLING", id, tx);
    await deleteAttachmentsFor("BILLING", id, tx);
    await deleteAttachmentsFor("BILLING_PAYMENT", abonos.map((a) => a.id), tx);
    await tx.billingItem.delete({ where: { id } });
  });

  recordActivity({
    entityType: "BILLING",
    entityId: id,
    action: "billing.deleted",
    label: etiqueta,
    meta: abonos.length > 0
      ? { note: `Se fueron con él ${abonos.length} ${abonos.length === 1 ? "abono" : "abonos"}.` }
      : null,
    actor: session.user,
  });

  revalidatePath("/facturacion");
  if (volverAlListado) redirect("/facturacion");
  return { ok: true as const };
}
