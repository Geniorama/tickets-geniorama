// Qué archivos se pueden adjuntar y cuánto pueden pesar. Lo usan los
// formularios —para avisar en cuanto se elige el archivo, antes de enviar nada—
// y el servidor, que vuelve a validarlo. Sin dependencias de servidor: se
// importa desde componentes cliente.

const IMAGES   = ["jpg", "jpeg", "png", "gif", "webp"];
const VIDEO    = ["mp4", "webm", "mov", "avi"];
const DOCS     = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"];
const ARCHIVES = ["zip", "rar", "7z", "tar", "gz", "tgz"];

export const MAX_FILE_BYTES  = 10  * 1024 * 1024; // 10 MB  (imágenes / docs / comprimidos)
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB (video)

export type FileRule = {
  /** Valor para el atributo `accept` del input. */
  accept: string;
  extensions: readonly string[];
  /** Texto para el usuario: «imágenes, PDF, Office y comprimidos». */
  description: string;
};

function rule(extensions: string[], description: string): FileRule {
  return { extensions, description, accept: extensions.map((e) => `.${e}`).join(",") };
}

export const FILE_RULES = {
  /** Adjuntos de la ficha: tickets, tareas y proyectos. */
  attachment:    rule([...IMAGES, ...VIDEO, ...DOCS, ...ARCHIVES], "imágenes, video, PDF, Word, Excel, PowerPoint y comprimidos"),
  /** Comentarios del equipo (tickets) y de tareas. */
  comment:       rule([...IMAGES, ...DOCS, ...ARCHIVES], "imágenes, PDF, Word, Excel, PowerPoint y comprimidos"),
  /** Comentarios de un cliente en un ticket. */
  clientComment: rule([...IMAGES, ...ARCHIVES], "imágenes y comprimidos"),
} as const;

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extensionOf(name: string) {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function isArchiveName(name: string) {
  return ARCHIVES.includes(extensionOf(name));
}

/** Límite de peso según el tipo: el video tiene uno propio. */
export function maxBytesFor(name: string) {
  return VIDEO.includes(extensionOf(name)) ? MAX_VIDEO_BYTES : MAX_FILE_BYTES;
}

/**
 * Comprueba un archivo contra una regla. Devuelve el mensaje de error listo
 * para mostrar, o null si se puede adjuntar.
 */
export function checkFile(file: { name: string; size: number }, fileRule: FileRule): string | null {
  if (!fileRule.extensions.includes(extensionOf(file.name))) {
    return `«${file.name}» no se puede adjuntar: solo se admiten ${fileRule.description}.`;
  }
  const max = maxBytesFor(file.name);
  if (file.size > max) {
    return `«${file.name}» pesa ${formatFileSize(file.size)} y el máximo es ${formatFileSize(max)}.`;
  }
  return null;
}

/**
 * Separa los archivos elegidos en válidos y errores. Los válidos se adjuntan
 * igual: un archivo malo no obliga a volver a elegir los buenos.
 */
export function splitFiles(files: File[], fileRule: FileRule): { valid: File[]; errors: string[] } {
  const valid: File[] = [];
  const errors: string[] = [];
  for (const f of files) {
    const err = checkFile(f, fileRule);
    if (err) errors.push(err);
    else valid.push(f);
  }
  return { valid, errors };
}
