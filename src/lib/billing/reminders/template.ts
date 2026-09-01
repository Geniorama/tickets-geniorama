import { formatAmount } from "@/lib/money";
import { formatDate } from "@/lib/format-date";

/**
 * Las marcas que puede usar quien escribe una regla.
 *
 * Deliberadamente pocas y en castellano: quien redacta el mensaje es quien
 * persigue el cobro, no quien programa. Una marca que no exista se deja tal
 * cual en el texto —tachar la frase entera por una llave mal puesta sería
 * peor— y el editor avisa antes de guardar.
 */

export type DatosCobro = {
  empresa: string;
  contacto: string;
  concepto: string;
  total: number;
  pendiente: number;
  vencimiento: Date | null;
  /** Días transcurridos desde el vencimiento. Negativo si aún no ha llegado. */
  dias: number;
  factura: string | null;
};

export const VARIABLES: { marca: string; descripcion: string }[] = [
  { marca: "empresa",     descripcion: "Nombre de la empresa que debe" },
  { marca: "contacto",    descripcion: "Nombre de pila de quien recibe el mensaje" },
  { marca: "concepto",    descripcion: "Qué se le cobra" },
  { marca: "total",       descripcion: "Importe total del cobro" },
  { marca: "pendiente",   descripcion: "Lo que falta por entrar" },
  { marca: "vencimiento", descripcion: "Fecha en que venció la factura" },
  { marca: "dias",        descripcion: "Días que lleva vencida" },
  { marca: "factura",     descripcion: "Número de factura" },
];

const NOMBRES = new Set(VARIABLES.map((v) => v.marca));

function valores(d: DatosCobro): Record<string, string> {
  return {
    empresa:     d.empresa,
    contacto:    d.contacto,
    concepto:    d.concepto,
    // `formatAmount` devuelve null si no hay importe. Aquí siempre lo hay
    // —un cobro sin dinero no se reclama—, pero el mensaje sale hacia fuera:
    // más vale una raya que la palabra «null» en el correo de un cliente.
    total:       formatAmount(d.total) ?? "—",
    pendiente:   formatAmount(d.pendiente) ?? "—",
    vencimiento: d.vencimiento ? formatDate(d.vencimiento) : "—",
    dias:        String(Math.abs(d.dias)),
    factura:     d.factura ?? "—",
  };
}

/** Sustituye `{{marca}}` por su valor. Deja intacta la que no reconoce. */
export function renderPlantilla(texto: string, datos: DatosCobro): string {
  const v = valores(datos);
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (entera, nombre: string) =>
    nombre in v ? v[nombre] : entera,
  );
}

/** Las marcas escritas que no existen, para avisar al guardar la regla. */
export function marcasDesconocidas(texto: string): string[] {
  const encontradas = [...texto.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(encontradas.filter((m) => !NOMBRES.has(m)))];
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

/**
 * El cuerpo lo escribe una persona en texto plano y acaba dentro de un correo
 * en HTML. Se escapa: un apellido con `&` o un concepto con `<` no deben poder
 * romper la maquetación, y menos aún meter etiquetas.
 */
export function aHtml(texto: string): string {
  return texto
    .replace(/[&<>"']/g, (c) => ESCAPES[c])
    .split("\n")
    .join("<br>");
}
