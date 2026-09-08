/**
 * Leer el documento que se le da a la IA.
 *
 * Un PDF no se convierte a texto aquí: se le pasa entero al modelo, que lee
 * mejor un PDF con su maquetación que cualquier extracción nuestra. Word y
 * texto plano sí se aplanan, porque ningún proveedor los acepta como adjunto.
 *
 * Lo usan el planificador de proyectos y el de tickets; vive aparte para que
 * añadir un formato nuevo se haga una sola vez.
 */

export type AiDocumentFile = { name: string; mimeType: string; dataBase64: string };

export type ExtractedDocument = { text?: string; pdfBase64?: string; error?: string };

export async function extractDocument(file: AiDocumentFile): Promise<ExtractedDocument> {
  const buf = Buffer.from(file.dataBase64, "base64");
  const lower = file.name.toLowerCase();

  if (file.mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    return { pdfBase64: file.dataBase64 };
  }
  if (
    lower.endsWith(".docx") ||
    file.mimeType.includes("officedocument.wordprocessing") ||
    file.mimeType === "application/msword"
  ) {
    try {
      const mammoth = await import("mammoth");
      const extract = mammoth.extractRawText ?? mammoth.default?.extractRawText;
      const res = await extract({ buffer: buf });
      return { text: res.value };
    } catch (err) {
      console.error("mammoth error:", err);
      return { error: "No se pudo leer el archivo de Word." };
    }
  }
  // txt / md / otros → texto plano
  return { text: buf.toString("utf8") };
}
