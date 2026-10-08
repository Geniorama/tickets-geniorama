import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatAmount } from "@/lib/money";
import { PayShell } from "../shell";

/**
 * Adonde Payments Way devuelve a quien paga.
 *
 * El estado se lee del intento guardado, que lo actualiza el aviso de la
 * pasarela, y no de la URL: lo que venga en la dirección lo puede escribir
 * cualquiera. Si el aviso aún no llegó, se dice que se está verificando.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Estado del pago — Geniorama", robots: { index: false, follow: false } };

const MENSAJES: Record<string, { titulo: string; texto: string; color: string }> = {
  success: {
    titulo: "Pago recibido",
    texto: "Recibimos tu pago y ya quedó registrado. ¡Gracias!",
    color: "#16a34a",
  },
  pending: {
    titulo: "Pago en proceso",
    texto: "Estamos esperando la confirmación del banco. No hace falta que pagues de nuevo: quedará registrado en cuanto se acredite.",
    color: "#b45309",
  },
  created: {
    titulo: "Estamos verificando tu pago",
    texto: "Si completaste el pago, quedará registrado en unos minutos. No hace falta que pagues de nuevo.",
    color: "#b45309",
  },
  failed: {
    titulo: "El pago no se completó",
    texto: "No se realizó ningún cobro. Puedes intentarlo de nuevo.",
    color: "#dc2626",
  },
  cancelled: {
    titulo: "Pago cancelado",
    texto: "No se realizó ningún cobro. Puedes intentarlo de nuevo cuando quieras.",
    color: "#64748b",
  },
  refunded: {
    titulo: "Pago devuelto",
    texto: "Este pago fue devuelto. Escríbenos si necesitas ayuda.",
    color: "#dc2626",
  },
};

export default async function ResultadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ orden?: string }>;
}) {
  const { token } = await params;
  const { orden: ordenId } = await searchParams;

  // La orden tiene que ser de este link: la llave de la dirección es lo que da
  // derecho a ver el estado.
  const orden = ordenId
    ? await prisma.billingGatewayOrder.findFirst({
        where: { id: ordenId, billingItem: { payToken: token } },
        select: { id: true, amount: true, status: true, billingItem: { select: { concept: true } } },
      })
    : null;
  if (!orden) notFound();

  const m = MENSAJES[orden.status] ?? MENSAJES.created;
  const reintentar = orden.status === "failed" || orden.status === "cancelled";

  return (
    <PayShell>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: m.color, margin: 0 }}>{m.titulo}</h1>
      <p style={{ fontSize: "0.9375rem", color: "var(--app-body-text)", margin: "0.75rem 0 0", lineHeight: 1.5 }}>
        {m.texto}
      </p>
      <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: "1rem 0 0" }}>
        {orden.billingItem.concept} · {formatAmount(orden.amount)} · orden {orden.id}
      </p>
      {reintentar && (
        <Link
          href={`/pagar/${token}`}
          style={{
            display: "inline-block", marginTop: "1.25rem", backgroundColor: "#fd1384", color: "#ffffff",
            borderRadius: "0.5rem", padding: "0.6rem 1.1rem", fontSize: "0.9375rem", fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Intentar de nuevo
        </Link>
      )}
    </PayShell>
  );
}
