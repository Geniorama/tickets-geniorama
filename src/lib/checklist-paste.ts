// Convierte texto pegado (una lista con viñetas, números, casillas, renglones
// tabulados, etc.) en ítems de checklist individuales. Cada renglón no vacío se
// vuelve un ítem; se eliminan los marcadores de lista al inicio.

// Viñetas comunes: guiones, asteriscos, puntos medios, flechas, etc.
const BULLET = /^[-*+•‣⁃·▪▫◦○●◆◇►▶➤➢»→]+\s*/;
// Numeración o letras: "1.", "1)", "12.", "a.", "a)" (requiere espacio tras letra).
const ORDERED = /^(?:\d{1,3}[.)]\s+|[a-zA-Z][.)]\s+)/;
// Casillas tipo Markdown / texto: "[ ]", "[x]", "[X]".
const CHECKBOX = /^\[[ xX]?\]\s*/;

/** Quita el marcador de lista al inicio de un renglón (viñeta, número, casilla). */
function stripMarker(line: string): string {
  let s = line.replace(/^[\s ]+/, ""); // espacios/tabs/no-break al inicio
  // El orden importa: "- [ ] tarea" → quita viñeta, luego casilla.
  s = s.replace(BULLET, "");
  s = s.replace(ORDERED, "");
  s = s.replace(CHECKBOX, "");
  // Por si quedó otra viñeta tras un número (p. ej. "1. - tarea").
  s = s.replace(BULLET, "");
  return s.trim();
}

/**
 * Parsea texto pegado en una lista de ítems de checklist.
 * Divide por renglones, limpia marcadores y descarta líneas vacías.
 */
export function parseChecklistPaste(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map(stripMarker)
    .filter((s) => s.length > 0);
}
