import { createClient } from "@supabase/supabase-js";

// Cliente con service role — solo usar en el servidor (Server Actions / Route Handlers)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const STORAGE_BUCKET = "ticket-attachments";

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

export async function uploadFile(
  file: File,
  ticketId: string
): Promise<{ storagePath: string; fileUrl: string }> {
  const ext = file.name.split(".").pop();
  const storagePath = `tickets/${ticketId}/${crypto.randomUUID()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (error) throw new Error(`Error al subir archivo: ${error.message}`);

  const { data } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 año

  if (!data?.signedUrl) throw new Error("No se pudo generar la URL del archivo");

  return { storagePath, fileUrl: data.signedUrl };
}

export async function deleteFile(storagePath: string): Promise<void> {
  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) throw new Error(`Error al eliminar archivo: ${error.message}`);
}

const LOGO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

export function validateLogo(file: File): string | null {
  if (file.size > MAX_LOGO_BYTES) return "El logo no puede superar los 2 MB";
  if (!LOGO_MIME_TYPES.includes(file.type)) return "Solo se permiten imágenes (JPG, PNG, WebP, GIF, SVG)";
  return null;
}

export async function uploadLogo(
  file: File,
  companyId: string
): Promise<{ storagePath: string; fileUrl: string }> {
  const ext = file.name.split(".").pop();
  const storagePath = `companies/${companyId}/logo.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });

  if (error) throw new Error(`Error al subir logo: ${error.message}`);

  // 10 años de validez para logos
  const { data } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365 * 10);

  if (!data?.signedUrl) throw new Error("No se pudo generar la URL del logo");

  return { storagePath, fileUrl: data.signedUrl };
}
