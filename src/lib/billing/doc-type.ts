import type { BillingDocType } from "@/generated/prisma";

export const DOC_TYPES = ["FACTURA", "CUENTA_COBRO"] as const satisfies readonly BillingDocType[];

export const DOC_TYPE_LABELS: Record<BillingDocType, string> = {
  FACTURA: "Factura",
  CUENTA_COBRO: "Cuenta de cobro",
};

/** El número que se pide al emitir, según el documento. */
export const DOC_NUMBER_LABELS: Record<BillingDocType, string> = {
  FACTURA: "Número de factura",
  CUENTA_COBRO: "Número de cuenta de cobro",
};

export function parseDocType(raw: unknown): BillingDocType {
  return raw === "CUENTA_COBRO" ? "CUENTA_COBRO" : "FACTURA";
}
