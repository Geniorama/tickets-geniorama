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

/**
 * Lo que además puede decir un correo mandado a mano.
 *
 * Las reglas no las tienen porque solo reclaman; un «pago recibido» necesita
 * hablar de lo que entró.
 */
export type DatosCorreo = DatosCobro & {
  abonado: number;
  ultimoAbono: number | null;
  fechaAbono: Date | null;
  /** La dirección de la página de pago en línea. Vacío si no se puede pagar así. */
  linkPago: string | null;
};

export const VARIABLES_CORREO: { marca: string; descripcion: string }[] = [
  ...VARIABLES,
  { marca: "abonado",      descripcion: "Todo lo que ya entró de este cobro" },
  { marca: "ultimo_abono", descripcion: "Importe del último pago recibido" },
  { marca: "fecha_abono",  descripcion: "Fecha del último pago recibido" },
  { marca: "link_pago",    descripcion: "Enlace para pagar en línea el saldo pendiente" },
];

function valores(d: DatosCobro | DatosCorreo): Record<string, string> {
  return {
    ...("abonado" in d
      ? {
          abonado:      formatAmount(d.abonado) ?? "—",
          ultimo_abono: formatAmount(d.ultimoAbono) ?? "—",
          fecha_abono:  d.fechaAbono ? formatDate(d.fechaAbono) : "—",
          link_pago:    d.linkPago ?? "—",
        }
      : {}),
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
export function renderPlantilla(texto: string, datos: DatosCobro | DatosCorreo): string {
  const v = valores(datos);
  return texto.replace(/\{\{\s*(\w+)\s*\}\}/g, (entera, nombre: string) =>
    nombre in v ? v[nombre] : entera,
  );
}

/** Las marcas escritas que no existen, para avisar al guardar la regla. */
export function marcasDesconocidas(texto: string, variables = VARIABLES): string[] {
  const nombres = new Set(variables.map((v) => v.marca));
  const encontradas = [...texto.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(encontradas.filter((m) => !nombres.has(m)))];
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
