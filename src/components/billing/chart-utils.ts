/**
 * Colores y formato de los gráficos del tablero gerencial.
 *
 * Vive aparte de `management-charts.tsx` ("use client") porque la página, que
 * es de servidor, también los usa: un Server Component no puede leer ni llamar
 * lo que exporta un módulo de cliente.
 */

export const C = {
  rosa: "#fd1384", verde: "#22c55e", indigo: "#6366f1", ambar: "#f59e0b",
  rojo: "#dc2626", gris: "#94a3b8", cian: "#06b6d4",
};

const pesos = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export const completo = (n: number) => pesos.format(n);

export function corto(n: number) {
  const a = Math.abs(n), s = n < 0 ? "-" : "";
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(1)} MM`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(1)} M`;
  if (a >= 1e3) return `${s}$${Math.round(a / 1e3)} k`;
  return `${s}$${Math.round(a)}`;
}
