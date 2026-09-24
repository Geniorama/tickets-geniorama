import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { EntityType } from "@/generated/prisma";
import { isArchiveName, formatFileSize, MAX_FILE_BYTES, MAX_VIDEO_BYTES } from "@/lib/file-rules";

// Carpeta en R2 por tipo de entidad. Las rutas coinciden con las que ya se
// venían usando, para no invalidar los archivos existentes.
//
// Parcial: `EntityType` incluye tipos que existen solo para el historial de
// acciones (usuarios, sitios, integraciones) y que no reciben archivos. Los que
// falten caen en `otros` en vez de construir una ruta con «undefined» dentro.
const COMMENT_FOLDERS: Partial<Record<EntityType, string>> = {
  TICKET:  "tickets",
  TASK:    "tasks",
  PROJECT: "projects",
  BILLING: "facturacion",
  BILLING_PAYMENT: "facturacion/abonos",
};

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;

// Si el bucket tiene dominio público configurado en R2 (r2.dev o custom domain),
// define CLOUDFLARE_R2_PUBLIC_URL para usar URLs permanentes.
// Si no, se generan presigned URLs con 7 días de validez.
async function getFileUrl(storagePath: string): Promise<string> {
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL?.replace(/\/$/, "");
  if (publicUrl) {
    return `${publicUrl}/${storagePath}`;
  }
  return getSignedUrl(
    r2,
    new GetObjectCommand({ Bucket: BUCKET, Key: storagePath }),
    { expiresIn: 60 * 60 * 24 * 7 } // 7 días (máximo con SigV4)
  );
}

// ─── Validación ───────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

const VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
]);

// Comprimidos. El MIME que manda el navegador no es fiable: Chrome en Windows
// envía un .zip como `application/x-zip-compressed` y un .rar o .7z muchas veces
// sin tipo o como `application/octet-stream`. Por eso se decide por la
// extensión, y el MIME solo tiene que ser uno de estos o venir vacío.
const ARCHIVE_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.rar",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  "application/x-gzip",
  "application/x-compressed",
]);

function isArchive(file: File): boolean {
  return isArchiveName(file.name) && ARCHIVE_MIME_TYPES.has(file.type);
}

export function validateFile(file: File): string | null {
  // El límite sale del mismo sitio que usan los formularios, para que el
  // servidor no rechace lo que el formulario dejó pasar.
  const limit = VIDEO_MIME_TYPES.has(file.type) ? MAX_VIDEO_BYTES : MAX_FILE_BYTES;
  if (file.size > limit) return `El archivo supera los ${formatFileSize(limit)}`;
  if (!ALLOWED_MIME_TYPES.includes(file.type) && !isArchive(file)) {
    return "Tipo de archivo no permitido. Solo imágenes, video, PDF, Word, Excel, PowerPoint y comprimidos (ZIP, RAR, 7Z)";
  }
  return null;
}

const LOGO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

export function validateLogo(file: File): string | null {
  if (file.size > MAX_LOGO_BYTES) return "El logo no puede superar los 2 MB";
  if (!LOGO_MIME_TYPES.includes(file.type))
    return "Solo se permiten imágenes (JPG, PNG, WebP, GIF, SVG)";
  return null;
}

const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateAvatar(file: File): string | null {
  if (file.size > MAX_AVATAR_BYTES) return "La foto no puede superar los 5 MB";
  if (!AVATAR_MIME_TYPES.includes(file.type))
    return "Solo se permiten imágenes (JPG, PNG, WebP, GIF)";
  return null;
}

// ─── Upload / Delete ──────────────────────────────────────────────────────────

async function putObject(storagePath: string, file: File): Promise<void> {
  const arrayBuffer = await file.arrayBuffer();
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storagePath,
      Body: Buffer.from(arrayBuffer),
      ContentType: file.type,
    })
  );
}

export async function uploadFile(
  file: File,
  ticketId: string
): Promise<{ storagePath: string; fileUrl: string }> {
  const ext = file.name.split(".").pop();
  const storagePath = `tickets/${ticketId}/${crypto.randomUUID()}.${ext}`;

  await putObject(storagePath, file);
  const fileUrl = await getFileUrl(storagePath);

  return { storagePath, fileUrl };
}

// Adjuntos de comentarios de cualquier entidad. Sustituye a la copia del cliente
// R2 que vivía dentro de task-comment.actions.ts.
export async function uploadCommentFile(
  file: File,
  entityType: EntityType,
  entityId: string
): Promise<{ storagePath: string; fileUrl: string }> {
  const ext = file.name.split(".").pop();
  const folder = COMMENT_FOLDERS[entityType] ?? "otros";
  const storagePath = `${folder}/${entityId}/comments/${crypto.randomUUID()}.${ext}`;

  await putObject(storagePath, file);
  const fileUrl = await getFileUrl(storagePath);

  return { storagePath, fileUrl };
}

export async function uploadLogo(
  file: File,
  companyId: string
): Promise<{ storagePath: string; fileUrl: string }> {
  const ext = file.name.split(".").pop();
  const storagePath = `companies/${companyId}/logo.${ext}`;

  await putObject(storagePath, file);
  const fileUrl = await getFileUrl(storagePath);

  return { storagePath, fileUrl };
}

export async function uploadAvatar(
  file: File,
  userId: string
): Promise<{ storagePath: string; fileUrl: string }> {
  const ext = file.name.split(".").pop();
  // UUID en el nombre para invalidar caché al cambiar la foto (URL pública permanente).
  const storagePath = `users/${userId}/avatar-${crypto.randomUUID()}.${ext}`;

  await putObject(storagePath, file);
  const fileUrl = await getFileUrl(storagePath);

  return { storagePath, fileUrl };
}

export async function deleteFile(storagePath: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: storagePath }));
}
