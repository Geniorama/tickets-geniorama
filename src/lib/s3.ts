import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export function validateFile(file: File): string | null {
  if (file.size > MAX_SIZE_BYTES) return "El archivo supera los 10 MB";
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return "Tipo de archivo no permitido. Solo imágenes, PDF y documentos Word";
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

export async function deleteFile(storagePath: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: storagePath }));
}
