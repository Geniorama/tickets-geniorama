/**
 * Convertir una entrada del historial en algo que se lee.
 *
 * Todo el formato ocurre aquí, al leer, y no al guardar: si mañana los importes
 * se escriben distinto, el historial viejo se arregla solo. La única excepción
 * son los nombres de usuario, que se congelan al escribir porque un id ya no
 * significa nada cuando esa persona se va (ver `record.ts`).
 *
 * Devuelve piezas, no una cadena montada: la interfaz necesita poner el «de X a
 * Y» en negrita y una frase entera no se deja pintar.
 */

import { formatAmount } from "@/lib/money";
import { formatDate } from "@/lib/format-date";
import { statusLabel } from "@/lib/status-labels";
import { actionSpec, fieldSpec, type FieldSpec } from "@/lib/activity/catalog";

const PRIORITY_LABELS: Record<string, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

/** Cómo se dice un campo vacío según lo que sea. */
function emptyLabel(kind: FieldSpec["kind"]): string {
  switch (kind) {
    case "user":  return "sin asignar";
    case "date":  return "sin fecha";
    case "list":  return "ninguno";
    case "money": return "sin importe";
    default:      return "vacío";
  }
}

/** Un valor del `changes`, escrito como se lee. */
export function formatValue(value: unknown, spec: FieldSpec): string {
  if (value === null || value === undefined || value === "") return emptyLabel(spec.kind);

  switch (spec.kind) {
    case "status":
      return statusLabel(String(value));

    case "priority":
      return PRIORITY_LABELS[String(value)] ?? statusLabel(String(value));

    case "money": {
      const n = typeof value === "number" ? value : Number(value);
      return Number.isFinite(n) ? (formatAmount(n) ?? String(value)) : String(value);
    }

    case "date": {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : formatDate(d);
    }

    case "bool": {
      const on = value === true || value === "true";
      const [off, yes] = spec.boolLabels ?? ["no", "sí"];
      return on ? yes : off;
    }

    case "list": {
      if (!Array.isArray(value)) return String(value);
      if (value.length === 0) return emptyLabel("list");
      return value.map(String).join(", ");
    }

    default: {
      const text = String(value);
      // Un título largo rompe la línea de tiempo; el historial dice qué cambió,
      // no guarda el contenido.
      return text.length > 120 ? `${text.slice(0, 117)}…` : text;
    }
  }
}

export type DescribedChange = {
  field: string;
  /** «el estado», «el importe» */
  label: string;
  /**
   * false cuando la acción ya nombró el campo.
   *
   * «Cambió el estado: el estado, de Abierto a Cerrado» es lo que sale si no se
   * mira esto, y con el tiempo es lo que hace que nadie lea el historial.
   */
  showLabel: boolean;
  from: string;
  to: string;
};

/**
 * Qué campo nombra ya cada acción en su propia etiqueta.
 *
 * Se mira por sufijo y no por acción completa porque el patrón se repite en
 * cada módulo: `ticket.status_changed`, `billing.status_changed`,
 * `task.status_changed` dicen todas «cambió el estado».
 */
const IMPLIED_FIELD: [suffix: string, field: string][] = [
  [".status_changed", "status"],
  [".stage_changed", "stage"],
  [".assigned", "assignedToId"],
  [".role_changed", "role"],
  [".access_changed", "access"],
  [".labels_changed", "labels"],
];

function impliedField(action: string): string | null {
  for (const [suffix, field] of IMPLIED_FIELD) {
    if (action.endsWith(suffix)) return field;
  }
  return null;
}

export type DescribedActivity = {
  /** «cambió el estado» */
  verb: string;
  tone: "create" | "update" | "move" | "destroy";
  changes: DescribedChange[];
  /** Frases sueltas que no vienen de un campo: «$300.000 por transferencia». */
  notes: string[];
};

/**
 * Lo que se pinta de una entrada.
 */
export function describeActivity(entry: {
  action: string;
  changes?: unknown;
  meta?: unknown;
}): DescribedActivity {
  const spec = actionSpec(entry.action);

  const implied = impliedField(entry.action);

  const changes: DescribedChange[] = [];
  if (entry.changes && typeof entry.changes === "object" && !Array.isArray(entry.changes)) {
    for (const [field, raw] of Object.entries(entry.changes as Record<string, unknown>)) {
      if (!raw || typeof raw !== "object") continue;
      const { from, to } = raw as { from?: unknown; to?: unknown };
      const campo = fieldSpec(field);
      changes.push({
        field,
        label: campo.label,
        showLabel: field !== implied,
        from: formatValue(from, campo),
        to: formatValue(to, campo),
      });
    }
  }

  const notes: string[] = [];
  if (entry.meta && typeof entry.meta === "object" && !Array.isArray(entry.meta)) {
    const meta = entry.meta as Record<string, unknown>;
    // `note` es la frase que quien registró la acción quiso dejar dicha tal
    // cual: el importe de un abono, el nombre del archivo, a quién se avisó.
    if (typeof meta.note === "string" && meta.note.trim()) notes.push(meta.note.trim());
  }

  return { verb: spec.label, tone: spec.tone, changes, notes };
}

/** El enlace propio que la acción dejó en `meta`, si lo hay. */
export function metaHref(meta: unknown): string | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const href = (meta as Record<string, unknown>).href;
  return typeof href === "string" && href.startsWith("/") ? href : null;
}
