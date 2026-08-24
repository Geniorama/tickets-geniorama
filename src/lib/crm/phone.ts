/**
 * Teléfonos en formato internacional (E.164).
 *
 * Un teléfono sirve para llamar aunque esté escrito como sea; para **enviar una
 * campaña** no. WhatsApp, los SMS y cualquier pasarela quieren `+573001234567`:
 * indicativo, sin espacios, sin guiones y sin el `0` de larga distancia. Si se
 * guarda «300 123 4567» hay que adivinar el país al exportar, y adivinar sobre
 * miles de contactos sale mal.
 *
 * Se normaliza al guardar, no al enviar: así lo que hay en la base ya está
 * listo, y el error se ve en el formulario y no seis meses después en un envío.
 *
 * No se usa una librería porque E.164 cabe en unas pocas reglas: `+`, de 8 a 15
 * dígitos, y el indicativo delante. Lo que una librería añadiría —validar que
 * el número existe de verdad en ese país— no lo sabe nadie hasta que se marca.
 */

export type Country = { iso: string; name: string; dial: string };

/**
 * Los países con los que se trabaja, no los 200 del mundo: una lista larga
 * convierte elegir el indicativo en buscar en un listín.
 */
export const COUNTRIES: Country[] = [
  { iso: "CO", name: "Colombia",       dial: "+57" },
  { iso: "US", name: "Estados Unidos", dial: "+1" },
  { iso: "MX", name: "México",         dial: "+52" },
  { iso: "ES", name: "España",         dial: "+34" },
  { iso: "AR", name: "Argentina",      dial: "+54" },
  { iso: "BR", name: "Brasil",         dial: "+55" },
  { iso: "CL", name: "Chile",          dial: "+56" },
  { iso: "PE", name: "Perú",           dial: "+51" },
  { iso: "EC", name: "Ecuador",        dial: "+593" },
  { iso: "PA", name: "Panamá",         dial: "+507" },
  { iso: "CR", name: "Costa Rica",     dial: "+506" },
  { iso: "UY", name: "Uruguay",        dial: "+598" },
];

/** El de casa. Es el indicativo que sale puesto por defecto. */
export const DEFAULT_DIAL = "+57";

/** Los indicativos, del más largo al más corto: «+593» antes que «+59». */
const DIALS = [...new Set(COUNTRIES.map((c) => c.dial))].sort((a, b) => b.length - a.length);

export type PhoneResult =
  | { ok: true; e164: string }
  | { ok: false; error: string };

/**
 * Deja el número en E.164, o dice por qué no puede.
 *
 * Acepta lo que la gente escribe de verdad: con espacios, guiones, paréntesis,
 * con `00` delante en vez de `+`, o sin indicativo —en ese caso se le pone el
 * del selector.
 */
export function normalizePhone(raw: string, dial: string = DEFAULT_DIAL): PhoneResult {
  const limpio = raw.trim();
  if (!limpio) return { ok: false, error: "El teléfono está vacío" };

  // Todo lo que no sea dígito o el «+» inicial sobra.
  let texto = limpio.replace(/[\s()./-]/g, "");

  // «0057» y «00 57» son la forma internacional de marcar en media Europa.
  if (texto.startsWith("00")) texto = "+" + texto.slice(2);

  if (!texto.startsWith("+")) {
    // Sin indicativo: se le pone el elegido. El `0` de larga distancia nacional
    // no forma parte del número internacional y se quita.
    texto = dial + texto.replace(/^0+/, "");
  }

  if (!/^\+\d+$/.test(texto)) {
    return { ok: false, error: "El teléfono solo puede tener dígitos y el indicativo" };
  }

  const digitos = texto.slice(1);
  // E.164 topa en 15 dígitos. Por abajo, menos de 8 no es un número marcable.
  if (digitos.length < 8) return { ok: false, error: "El teléfono es demasiado corto" };
  if (digitos.length > 15) return { ok: false, error: "El teléfono es demasiado largo" };

  return { ok: true, e164: texto };
}

/** Separa un E.164 en indicativo y número, para poder rellenar el formulario. */
export function splitPhone(e164: string | null | undefined): { dial: string; national: string } {
  if (!e164) return { dial: DEFAULT_DIAL, national: "" };
  const dial = DIALS.find((d) => e164.startsWith(d));
  return dial
    ? { dial, national: e164.slice(dial.length) }
    : { dial: DEFAULT_DIAL, national: e164.replace(/^\+/, "") };
}

/**
 * Cómo se lee en pantalla: `+57 300 123 4567`.
 *
 * Es solo presentación — lo que se guarda y lo que se exporta a una campaña
 * sigue siendo el E.164 sin espacios.
 */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const { dial, national } = splitPhone(e164);
  if (!national) return e164;

  // Diez dígitos se leen mejor en 3-3-4; el resto, en grupos de tres.
  const grupos =
    national.length === 10
      ? [national.slice(0, 3), national.slice(3, 6), national.slice(6)]
      : (national.match(/.{1,3}/g) ?? [national]);

  return `${dial} ${grupos.join(" ")}`;
}
