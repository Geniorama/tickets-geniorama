import { BILLING_STATUS_LABELS } from "@/lib/billing/status";
import { formatDate } from "@/lib/format-date";
import type { BillingStatus } from "@/generated/prisma";

/**
 * El detalle de facturación como CSV.
 *
 * Vive aparte de la ruta para poder probarlo: la ruta solo pone el guardia y
 * los encabezados, y eso necesita un request de verdad. Lo que puede estar
 * sutilmente mal —un nombre con comas que parte una fila— está aquí.
 */

export type LineaExportable = {
  concept: string;
  amount: number;
  taxRate: number;
  category: { name: string } | null;
  billingItem: {
    concept: string;
    invoiceNumber: string | null;
    invoicedAt: Date | null;
    status: BillingStatus;
    company: { name: string };
  };
};

export const COLUMNAS = [
  "Fecha de factura", "Factura", "Cliente", "Cobro",
  "Concepto", "Categoría", "Base", "IVA %", "Estado",
];

/**
 * Escapa un campo.
 *
 * Se entrecomilla siempre, no solo cuando hay comas: los nombres de empresa
 * llevan comas y puntos («Acme S.A.S., Ltda»), los conceptos llevan comillas, y
 * decidir caso por caso es cómo se rompe un fichero a mitad de año.
 */
export function campo(valor: string | number | null | undefined): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  return `"${texto.replace(/"/g, '""')}"`;
}

export function construirCsv(lineas: LineaExportable[]): string {
  const filas = lineas.map((l) =>
    [
      campo(l.billingItem.invoicedAt ? formatDate(l.billingItem.invoicedAt) : ""),
      campo(l.billingItem.invoiceNumber),
      campo(l.billingItem.company.name),
      campo(l.billingItem.concept),
      campo(l.concept),
      campo(l.category?.name ?? "Sin categoría"),
      // El importe va crudo, sin separadores ni signo de peso: una hoja de
      // cálculo tiene que poder sumarlo, y «$ 1.200.000» es texto.
      campo(l.amount),
      campo(l.taxRate),
      campo(BILLING_STATUS_LABELS[l.billingItem.status]),
    ].join(","),
  );

  // BOM al principio: sin él, Excel abre el fichero en Latin-1 y los acentos
  // salen rotos. Es el detalle que hace que un CSV se vea «mal hecho».
  return "﻿" + [COLUMNAS.map(campo).join(","), ...filas].join("\r\n");
}
