/**
 * Sugerencias al crear un ticket (AG·P-4).
 *
 * Los tickets nacían sin categoría porque elegirla es un paso más y nadie
 * recuerda en qué categoría cae «renovar el dominio». Aquí se propone una a
 * partir del título; quien crea el ticket siempre puede cambiarla.
 */

export const TICKET_CATEGORIES = [
  "Soporte técnico",
  "Facturación",
  "Desarrollo",
  "Diseño",
  "Consultoría",
  "Hosting",
  "Dominio",
  "Correos",
  "Otro",
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

/** Palabras que delatan cada categoría. Van sin tildes y en minúscula. */
const KEYWORDS: Record<Exclude<TicketCategory, "Otro">, string[]> = {
  Dominio: ["dominio", "dns", "whois", "nameserver", "registrar"],
  Hosting: ["hosting", "servidor", "vps", "cpanel", "ssl", "certificado", "aws", "backup", "copia de seguridad"],
  Correos: ["correo", "email", "e-mail", "mail", "smtp", "buzon", "outlook", "spam"],
  Facturación: ["factura", "cobro", "pago", "cotizacion", "presupuesto", "abono", "cuenta de cobro"],
  Diseño: ["diseno", "banner", "logo", "maquetacion", "figma", "imagen", "pieza", "landing", "flyer", "brand"],
  Desarrollo: ["desarrollo", "desarrollar", "funcionalidad", "plugin", "integrar", "integracion", "api", "modulo", "implementar", "formulario", "automatizacion", "agente"],
  Consultoría: ["asesoria", "consultoria", "reunion", "capacitacion", "estrategia", "auditoria", "optimizacion"],
  "Soporte técnico": ["error", "falla", "fallo", "no carga", "caido", "bug", "no funciona", "problema", "lento", "no abre", "wordpress", "actualizar", "actualizacion"],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * La categoría que mejor encaja con un título, o null si no hay pista clara.
 * Cuenta coincidencias por categoría y se queda con la que más tenga; en un
 * empate manda el orden de `KEYWORDS`, que va de lo más específico a lo más
 * genérico.
 */
export function suggestCategory(title: string): TicketCategory | null {
  const text = normalize(title);
  if (text.trim().length < 4) return null;

  let best: TicketCategory | null = null;
  let bestScore = 0;
  for (const [category, words] of Object.entries(KEYWORDS) as [TicketCategory, string[]][]) {
    const score = words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0);
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best;
}
