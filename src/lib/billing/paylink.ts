/**
 * Link de pago en línea de un cobro, con Payments Way.
 *
 * Payments Way no tiene una API que devuelva un link: su integración es un
 * formulario que el navegador de quien paga envía a su pasarela, y un aviso
 * (webhook) que llega cuando el pago se resuelve. Así que el «link de pago» es
 * una página nuestra, `/pagar/<token>`, que enseña qué se cobra y arma ese
 * formulario. Es la misma integración que ya usa el sitio de hosting.
 *
 * Vive fuera de las Server Actions y de la ruta del webhook por lo mismo que
 * `move.ts`: esto toca dinero y tiene que poder probarse desde un script.
 */

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isInvoiced, pendiente } from "@/lib/billing/status";
import { registrarPago } from "@/lib/billing/payments";
import { apuntarEnCobro, resumenAbono } from "@/lib/billing/items";
import { avisarFacturacion } from "@/lib/billing/notify";

export const PAYMENTSWAY_REDIRECT_URL = "https://merchant.paymentsway.co/cartaspago/redirect";

/** Con qué nombre queda apuntado el abono. */
export const METODO_EN_LINEA = "Payments Way";

const ENV = ["PAYMENTSWAY_MERCHANT_ID", "PAYMENTSWAY_FORM_ID", "PAYMENTSWAY_TERMINAL_ID", "PAYMENTSWAY_API_KEY"] as const;

/** Las credenciales que faltan. Vacío si la pasarela está lista. */
export function credencialesQueFaltan(): string[] {
  return ENV.filter((k) => !process.env[k]);
}

export const pasarelaLista = () => credencialesQueFaltan().length === 0;

const baseUrl = () => (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const urlDePago = (token: string) => `${baseUrl()}/pagar/${token}`;

// ─── El link ─────────────────────────────────────────────────────────────────

/**
 * ¿Se puede pagar este cobro en línea ahora mismo?
 *
 * Las mismas dos condiciones que para apuntar un abono a mano: que esté
 * facturado —no se cobra lo que el cliente aún no recibió— y que deba algo.
 */
export function motivoNoPagable(cobro: { status: Parameters<typeof isInvoiced>[0]; amount: number; paidAmount: number }): string | null {
  if (!isInvoiced(cobro.status)) return "El cobro todavía no está facturado";
  if (pendiente(cobro.amount, cobro.paidAmount) <= 0) return "El cobro ya no tiene saldo pendiente";
  return null;
}

/**
 * Devuelve la llave del link de pago del cobro, creándola si no la tenía.
 *
 * La llave se conserva: el link que ya se mandó por correo tiene que seguir
 * abriendo mañana. Con la condición dentro del `update`, dos peticiones a la
 * vez no dejan dos llaves distintas circulando.
 */
export async function asegurarLinkDePago(billingItemId: string): Promise<string | null> {
  const cobro = await prisma.billingItem.findUnique({
    where: { id: billingItemId },
    select: { payToken: true },
  });
  if (!cobro) return null;
  if (cobro.payToken) return cobro.payToken;

  const token = crypto.randomBytes(24).toString("base64url");
  await prisma.billingItem.updateMany({
    where: { id: billingItemId, payToken: null },
    data: { payToken: token },
  });
  const final = await prisma.billingItem.findUnique({ where: { id: billingItemId }, select: { payToken: true } });
  return final?.payToken ?? null;
}

// ─── El formulario hacia la pasarela ─────────────────────────────────────────

export const TIPOS_DOCUMENTO = ["CC", "NIT", "CE", "PA"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

export type Pagador = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  docType: TipoDocumento;
  docNumber: string;
};

export type FormularioDePago = { url: string; fields: Record<string, string> };

export type InicioDePago = { ok: true; form: FormularioDePago } | { ok: false; error: string };

/**
 * Abre un intento de pago por el saldo pendiente y devuelve el formulario que
 * el navegador tiene que enviar a Payments Way.
 *
 * El importe se lee aquí, del cobro, y no de lo que mande la página: quien
 * paga no elige cuánto debe.
 */
export async function iniciarPago(token: string, pagador: Pagador): Promise<InicioDePago> {
  if (!pasarelaLista()) return { ok: false, error: "El pago en línea no está disponible en este momento" };

  const cobro = await prisma.billingItem.findUnique({
    where: { payToken: token },
    select: {
      id: true, concept: true, status: true, amount: true, paidAmount: true, invoiceNumber: true,
      createdById: true, ownerId: true,
    },
  });
  if (!cobro) return { ok: false, error: "Este link de pago no existe" };

  const motivo = motivoNoPagable(cobro);
  if (motivo) return { ok: false, error: motivo };

  const amount = Math.round(pendiente(cobro.amount, cobro.paidAmount));
  // Corto y sin relación con el id del cobro: es lo que ve el cliente en su
  // comprobante y lo que la pasarela devuelve en el aviso.
  const orderId = `GC-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

  await prisma.billingGatewayOrder.create({
    data: {
      id: orderId,
      amount,
      billingItemId: cobro.id,
      payerEmail: pagador.email,
      // A nombre de quien lleva el cobro; si nadie, de quien lo creó.
      createdById: cobro.ownerId ?? cobro.createdById,
    },
  });

  const descripcion = cobro.invoiceNumber ? `${cobro.concept} (factura ${cobro.invoiceNumber})` : cobro.concept;

  return {
    ok: true,
    form: {
      url: PAYMENTSWAY_REDIRECT_URL,
      fields: {
        merchant_id: process.env.PAYMENTSWAY_MERCHANT_ID!,
        form_id: process.env.PAYMENTSWAY_FORM_ID!,
        terminal_id: process.env.PAYMENTSWAY_TERMINAL_ID!,
        order_number: orderId,
        amount: String(amount),
        currency: "COP",
        order_description: descripcion.slice(0, 200),
        client_email: pagador.email,
        client_phone: pagador.phone,
        client_firstname: pagador.firstName,
        client_lastname: pagador.lastName,
        client_doctype: pagador.docType,
        client_numdoc: pagador.docNumber.replace(/\D/g, ""),
        response_url: `${urlDePago(token)}/resultado?orden=${encodeURIComponent(orderId)}`,
      },
    },
  };
}

// ─── El aviso de la pasarela ─────────────────────────────────────────────────

export type AvisoPaymentsWay = {
  id: string | number;
  ammount: number;
  externalorder: string;
  idstatus: { id: number; nombre?: string };
  checksum?: string;
};

const ESTADOS: Record<number, string> = {
  1: "created",
  34: "success",
  35: "pending",
  36: "failed",
  38: "cancelled",
  39: "refunded",
  40: "pending",
};

export const ESTADO_EXITOSO = 34;

/**
 * La firma del aviso: sha256 de `form;apiKey;merchant;importe;orden`.
 *
 * Aquí es **obligatoria**. El sitio de hosting deja pasar un aviso sin firma,
 * pero allí un aviso falso activa un hosting; aquí marcaría como cobrada una
 * factura que nadie pagó. El número de orden lo conoce quien paga —va en su
 * URL de retorno—, así que sin la firma cualquiera con el link podría
 * fabricarse su propio «pago exitoso».
 */
export function firmaValida(aviso: AvisoPaymentsWay): boolean {
  if (!aviso.checksum || !pasarelaLista()) return false;
  const raw = [
    process.env.PAYMENTSWAY_FORM_ID,
    process.env.PAYMENTSWAY_API_KEY,
    process.env.PAYMENTSWAY_MERCHANT_ID,
    aviso.ammount,
    aviso.externalorder,
  ].join(";");
  const esperada = crypto.createHash("sha256").update(raw).digest("hex");
  const a = Buffer.from(esperada);
  const b = Buffer.from(String(aviso.checksum).toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export type ResultadoAviso =
  | { ok: true; status: string; apuntado: boolean }
  | { ok: false; error: string; http: number };

/**
 * Procesa un aviso ya leído: mueve el intento de estado y, si el pago entró,
 * apunta el abono en el cobro.
 *
 * Payments Way repite el aviso si no recibe respuesta, así que el paso a
 * `success` va con la condición dentro del `update`: solo el primero que llega
 * apunta el abono.
 */
export async function procesarAviso(aviso: AvisoPaymentsWay): Promise<ResultadoAviso> {
  if (!firmaValida(aviso)) return { ok: false, error: "Firma no válida", http: 401 };

  const orden = await prisma.billingGatewayOrder.findUnique({
    where: { id: String(aviso.externalorder) },
    select: { id: true, amount: true, status: true, billingItemId: true, createdById: true },
  });
  // No es nuestra: la misma cuenta de Payments Way cobra también el hosting.
  if (!orden) return { ok: false, error: "Orden desconocida", http: 404 };

  const status = ESTADOS[aviso.idstatus?.id] ?? "pending";
  const paymentRef = String(aviso.id);

  if (status !== "success") {
    // Un intento ya cobrado no retrocede por un aviso tardío de «pendiente».
    await prisma.billingGatewayOrder.updateMany({
      where: { id: orden.id, status: { not: "success" } },
      data: { status, paymentRef },
    });
    return { ok: true, status, apuntado: false };
  }

  // La firma ya cubre el importe, pero se compara igual con lo que se mandó a
  // cobrar: un abono por otra cifra no se apunta sin que alguien lo mire.
  if (Math.round(Number(aviso.ammount)) !== Math.round(orden.amount)) {
    console.error("[paymentsway] importe distinto al de la orden", { orden: orden.id, aviso: aviso.ammount, esperado: orden.amount });
    return { ok: false, error: "El importe no coincide con la orden", http: 409 };
  }

  const { count } = await prisma.billingGatewayOrder.updateMany({
    where: { id: orden.id, status: { not: "success" } },
    data: { status: "success", paymentRef },
  });
  if (count === 0) return { ok: true, status, apuntado: false };

  const datos = { amount: orden.amount, paidOn: new Date(), method: METODO_EN_LINEA };
  const pago = await registrarPago(
    orden.billingItemId,
    { ...datos, note: `Pago en línea · orden ${orden.id} · ref. ${paymentRef}` },
    orden.createdById,
  );

  if (!pago.ok) {
    // El dinero entró pero el cobro no admite el abono (lo devolvieron a «Por
    // facturar» mientras tanto, por ejemplo). No se pierde: queda dicho en el
    // hilo del cobro para que alguien lo apunte a mano.
    console.error("[paymentsway] pago recibido sin poder apuntarlo", { orden: orden.id, error: pago.error });
    await prisma.comment.create({
      data: {
        entityType: "BILLING",
        entityId: orden.billingItemId,
        body: `Entró un pago en línea de ${resumenAbono(datos)} (orden ${orden.id}, ref. ${paymentRef}) que no se pudo apuntar: ${pago.error}. Hay que registrarlo a mano.`,
        authorId: orden.createdById,
        isInternal: true,
      },
    }).catch(() => {});
    return { ok: true, status, apuntado: false };
  }

  await prisma.billingGatewayOrder.update({ where: { id: orden.id }, data: { paymentId: pago.id } });
  await apuntarEnCobro(orden.billingItemId, "billing.payment_added", { id: orden.createdById }, {
    note: `${resumenAbono(datos)} · pago en línea`,
  });
  await avisarFacturacion({ id: orden.createdById }, orden.billingItemId, { tipo: "en_linea", amount: orden.amount });

  return { ok: true, status, apuntado: true };
}
