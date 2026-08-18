/**
 * Normalización de números de WhatsApp.
 *
 * Todo el sistema guarda y compara números en E.164 **sin** el «+»
 * (573001234567), que es exactamente la forma en que Meta entrega el campo
 * `from` del mensaje. Guardar cualquier otra variante rompería la búsqueda por
 * `whatsappPhone`, que es una igualdad exacta contra un índice único.
 */

/** Indicativo que se asume cuando el número llega sin país. */
const DEFAULT_COUNTRY_CODE = "57"; // Colombia

/**
 * Lleva un número a E.164 sin «+», o devuelve null si no puede.
 *
 * Acepta lo que un humano escribe («300 123 4567», «+57 300-123-4567»,
 * «0057300…») y lo que manda Meta («573001234567»).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  // Prefijo internacional marcado como «00» → sobra.
  if (digits.startsWith("00")) digits = digits.slice(2);

  // Móvil colombiano local (10 dígitos que empiezan por 3): le falta el país.
  if (digits.length === 10 && digits.startsWith("3")) {
    digits = DEFAULT_COUNTRY_CODE + digits;
  }

  // E.164 admite entre 8 y 15 dígitos contando el indicativo.
  if (digits.length < 8 || digits.length > 15) return null;

  return digits;
}

/** Versión legible para mostrar en la interfaz: «+57 3001234567». */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  return `+${phone}`;
}
