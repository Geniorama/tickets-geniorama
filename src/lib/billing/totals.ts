/**
 * Las cuentas de un cobro: bases, IVA y total.
 *
 * Función pura y aparte porque es lo único aquí que puede estar *sutilmente*
 * mal: un céntimo de más no rompe nada visible, aparece meses después cuando
 * un total no cuadra con la factura de verdad.
 */

/** El IVA general en Colombia. Se ofrece en la interfaz; en la base va por línea. */
export const IVA_RATE = 19;

/** Exento se guarda como tasa cero: un solo campo para «cuánto», no dos. */
export const EXENTO = 0;

export type LineaCobro = {
  concept: string;
  /** Base imponible, sin impuesto. */
  amount: number;
  /** Porcentaje. Cero es exento. */
  taxRate: number;
};

export type Totales = {
  subtotal: number;
  taxAmount: number;
  total: number;
};

/** Se factura en pesos colombianos, donde los centavos no existen en la práctica. */
function aPesos(n: number): number {
  return Math.round(n);
}

/**
 * Suma bases, IVA y total.
 *
 * El impuesto se calcula **por tarifa sobre la base acumulada**, no línea a
 * línea. Es como lo declara una factura —«base gravada al 19 %: X, IVA: Y»— y
 * evita que se acumule el redondeo: con tres líneas de 333.333 al 19 %,
 * redondear cada una da 189.999 y la factura real dice 190.000. Un peso no
 * rompe nada, pero es el peso que nadie sabe explicar cuando no cuadra.
 */
export function calcularTotales(lineas: LineaCobro[]): Totales {
  const basePorTarifa = new Map<number, number>();
  let subtotal = 0;

  for (const l of lineas) {
    const base = aPesos(l.amount);
    subtotal += base;
    basePorTarifa.set(l.taxRate, (basePorTarifa.get(l.taxRate) ?? 0) + base);
  }

  let taxAmount = 0;
  for (const [tarifa, base] of basePorTarifa) {
    if (tarifa > 0) taxAmount += aPesos((base * tarifa) / 100);
  }

  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

/** Cómo se lee una línea: «Exento» o «+19% IVA». */
export function describirImpuesto(taxRate: number): string {
  return taxRate === 0 ? "Exento" : `+${taxRate}% IVA`;
}

export type LineaConCategoria = LineaCobro & {
  categoryId: string | null;
  categoryName: string | null;
};

export type Reparto = {
  categoryId: string | null;
  /** «Sin categoría» para lo que nadie catalogó. */
  nombre: string;
  /** Base imponible de esa categoría. */
  base: number;
  /** Qué parte del subtotal representa, de 0 a 100. */
  porcentaje: number;
};

/**
 * Cómo se reparte un cobro entre categorías.
 *
 * **Reparte la base, no el total con IVA**, y no es una simplificación: el IVA
 * se calcula por tarifa sobre la base acumulada de toda la factura, así que
 * trocearlo por categoría obligaría a redondear dentro de cada trozo y la suma
 * de los trozos dejaría de dar el total. Es el mismo peso descuadrado que
 * explica `calcularTotales`, pero repetido por categoría y más difícil de ver.
 *
 * Además, contabilidad cataloga servicios por su valor neto: el IVA es una
 * cuenta aparte y no pertenece a ninguna categoría.
 *
 * Garantía: la suma de las bases devueltas es exactamente el subtotal.
 */
export function repartoPorCategoria(lineas: LineaConCategoria[]): Reparto[] {
  const porCategoria = new Map<string | null, { nombre: string; base: number }>();

  for (const l of lineas) {
    const clave = l.categoryId;
    const actual = porCategoria.get(clave);
    const base = aPesos(l.amount);
    if (actual) actual.base += base;
    else porCategoria.set(clave, { nombre: l.categoryName ?? "Sin categoría", base });
  }

  const subtotal = [...porCategoria.values()].reduce((s, c) => s + c.base, 0);

  return [...porCategoria.entries()]
    .map(([categoryId, c]) => ({
      categoryId,
      nombre: c.nombre,
      base: c.base,
      porcentaje: subtotal > 0 ? (c.base / subtotal) * 100 : 0,
    }))
    // De más a menos dinero: es el orden en que se mira un reparto. Lo sin
    // catalogar al final, aunque pese, porque es una tarea pendiente y no una
    // categoría de verdad.
    .sort((a, b) =>
      a.categoryId === null ? 1 : b.categoryId === null ? -1 : b.base - a.base,
    );
}
