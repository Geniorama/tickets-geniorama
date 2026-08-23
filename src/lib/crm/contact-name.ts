/**
 * El nombre de un contacto, compuesto y descompuesto.
 *
 * En la base viven separados —se filtra y se ordena por apellido, y un correo
 * que empieza por «Hola Ana» necesita solo el nombre de pila—, pero casi todas
 * las pantallas quieren la persona entera. Componerlo aquí evita que cada sitio
 * decida su propio formato.
 */

export type ContactNameParts = { firstName: string; lastName?: string | null };

export function fullName(contact: ContactNameParts): string {
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim();
}

/**
 * Parte un nombre entero en nombre y apellidos.
 *
 * Corta por el **primer** espacio: lo de antes es el nombre de pila, lo de
 * después son los apellidos. Es lo correcto en español, donde son dos —«Ana
 * Pérez Gómez» da «Ana» + «Pérez Gómez»—; cortar por el último dejaría «Ana
 * Pérez» de nombre.
 *
 * Se usa donde todavía llega un nombre entero: la API pública, que aceptaba
 * `name` antes de esta separación y tiene que seguir aceptándolo.
 */
export function splitName(name: string): { firstName: string; lastName: string | null } {
  const limpio = name.trim().replace(/\s+/g, " ");
  const corte = limpio.indexOf(" ");
  if (corte === -1) return { firstName: limpio, lastName: null };
  return {
    firstName: limpio.slice(0, corte),
    lastName: limpio.slice(corte + 1) || null,
  };
}
