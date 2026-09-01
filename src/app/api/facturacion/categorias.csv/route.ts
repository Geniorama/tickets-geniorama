import { NextRequest, NextResponse } from "next/server";
import { requireCan } from "@/lib/access/can";
import { lineasDelPeriodo, periodoDesdeParams } from "@/lib/billing/categories";
import { construirCsv } from "@/lib/billing/csv";

/**
 * El detalle del periodo, línea a línea, para llevárselo a una hoja de cálculo.
 *
 * Contabilidad no vive en esta aplicación: por muy bien que se pinte el reparto
 * en pantalla, lo que necesita es pegarlo en su libro. Una pantalla que no se
 * puede exportar obliga a copiar números a mano, y ahí aparecen los errores.
 *
 * Aquí solo va el guardia y los encabezados; el CSV se arma en `billing/csv.ts`
 * para poder probarlo sin un request.
 */
export async function GET(req: NextRequest) {
  await requireCan("FACTURACION", "ver");

  const { searchParams } = new URL(req.url);
  const periodo = periodoDesdeParams(
    searchParams.get("desde") ?? undefined,
    searchParams.get("hasta") ?? undefined,
  );

  const csv = construirCsv(await lineasDelPeriodo(periodo));
  const nombre = `facturacion-${periodo.desde.toISOString().slice(0, 10)}-a-${periodo.hasta.toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      // Un informe contable no se cachea: se pide justo cuando algo cambió.
      "Cache-Control": "no-store",
    },
  });
}
