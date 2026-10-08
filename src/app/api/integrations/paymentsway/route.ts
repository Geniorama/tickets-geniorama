import { NextResponse } from "next/server";
import { ESTADO_EXITOSO, procesarAviso, type AvisoPaymentsWay } from "@/lib/billing/paylink";

/**
 * El aviso de Payments Way cuando un pago en línea se resuelve.
 *
 * No lleva sesión ni llave: lo que lo autentica es la firma del propio aviso,
 * que se comprueba en `procesarAviso`. La URL se da de alta en la consola de
 * Payments Way, en el formulario que usa Facturación.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let aviso: AvisoPaymentsWay;
  try {
    aviso = (await req.json()) as AvisoPaymentsWay;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }
  if (!aviso?.externalorder || !aviso?.idstatus) {
    return new NextResponse("Invalid payload", { status: 400 });
  }

  let r;
  try {
    r = await procesarAviso(aviso);
  } catch (err) {
    // Con 500 la pasarela reintenta, que es lo que se quiere si falló la base.
    console.error("[paymentsway:webhook]", err);
    return new NextResponse("Error", { status: 500 });
  }

  if (!r.ok) {
    console.warn("[paymentsway:webhook]", r.error, { orden: aviso.externalorder });
    return new NextResponse(r.error, { status: r.http });
  }

  console.log("[paymentsway:webhook]", { orden: aviso.externalorder, status: r.status, apuntado: r.apuntado });

  // Payments Way espera 200 solo para un pago exitoso y 201 para el resto.
  return NextResponse.json({ ok: true }, { status: aviso.idstatus.id === ESTADO_EXITOSO ? 200 : 201 });
}
