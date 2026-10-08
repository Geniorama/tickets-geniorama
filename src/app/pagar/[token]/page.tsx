import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { pendiente } from "@/lib/billing/status";
import { motivoNoPagable, pasarelaLista } from "@/lib/billing/paylink";
import { formatAmount } from "@/lib/money";
import { PayForm } from "@/components/billing/pay-form";
import { PayShell } from "./shell";

/**
 * La página a la que lleva el link de pago de un cobro.
 *
 * Es pública: la abre el cliente, que no tiene cuenta. Enseña lo mínimo para
 * que reconozca qué paga —empresa, concepto, factura y saldo— y nada más del
 * cobro: ni notas, ni abonos anteriores, ni quién lo lleva.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Pago en línea — Geniorama", robots: { index: false, follow: false } };

export default async function PagarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const cobro = await prisma.billingItem.findUnique({
    where: { payToken: token },
    select: {
      concept: true, status: true, amount: true, paidAmount: true, invoiceNumber: true,
      company: { select: { name: true } },
    },
  });
  if (!cobro) notFound();

  const falta = pendiente(cobro.amount, cobro.paidAmount);
  const motivo = motivoNoPagable(cobro);
  const importe = formatAmount(falta) ?? String(falta);

  return (
    <PayShell>
      <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: 0 }}>{cobro.company.name}</p>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--app-body-text)", margin: "0.25rem 0 0" }}>
        {cobro.concept}
      </h1>
      {cobro.invoiceNumber && (
        <p style={{ fontSize: "0.875rem", color: "var(--app-text-muted)", margin: "0.25rem 0 0" }}>
          Factura {cobro.invoiceNumber}
        </p>
      )}

      {motivo ? (
        <p style={{ fontSize: "0.9375rem", color: "var(--app-body-text)", margin: "1.5rem 0 0" }}>
          {falta <= 0
            ? "Esta factura ya está pagada. ¡Gracias!"
            : "Esta factura todavía no está disponible para pago en línea. Escríbenos si necesitas ayuda."}
        </p>
      ) : (
        <>
          <div style={{ margin: "1.25rem 0", padding: "1rem 1.1rem", borderRadius: "0.6rem", backgroundColor: "var(--app-content-bg)", border: "1px solid var(--app-border)" }}>
            <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: 0 }}>Total a pagar</p>
            <p style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--app-body-text)", margin: "0.1rem 0 0" }}>{importe}</p>
            {cobro.paidAmount > 0 && (
              <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: "0.25rem 0 0" }}>
                Saldo pendiente de un total de {formatAmount(cobro.amount)}.
              </p>
            )}
          </div>

          {pasarelaLista() ? (
            <PayForm token={token} importe={importe} />
          ) : (
            <p style={{ fontSize: "0.9375rem", color: "var(--app-body-text)", margin: 0 }}>
              El pago en línea no está disponible en este momento. Escríbenos y te ayudamos.
            </p>
          )}
        </>
      )}
    </PayShell>
  );
}
