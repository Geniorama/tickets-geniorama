/**
 * Notas de voz en el chat con GENIA.
 *
 * El agente de n8n recibe texto, así que la plataforma transcribe el audio
 * antes de reenviarlo (OpenAI, la misma clave que usa el asistente del equipo).
 * El audio no se guarda en ningún lado: se transcribe y se descarta; lo que
 * queda en la conversación es la transcripción, marcada como nota de voz para
 * que el cliente vea qué se entendió.
 */

import OpenAI from "openai";

/** Unos 2 minutos de voz en los formatos que graba el navegador sobran con esto. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";

/** Lo que graban Chrome/Firefox (webm, ogg) y Safari (mp4), más los formatos de archivo comunes. */
const EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

export function audioTranscriptionAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

let client: OpenAI | null = null;

export type TranscribeResult = { ok: true; text: string } | { ok: false; error: string };

export async function transcribeAudio(file: File): Promise<TranscribeResult> {
  if (!audioTranscriptionAvailable()) return { ok: false, error: "Las notas de voz no están disponibles todavía." };
  if (file.size === 0) return { ok: false, error: "La nota de voz llegó vacía. Grábala de nuevo." };
  if (file.size > MAX_AUDIO_BYTES) return { ok: false, error: "La nota de voz es muy larga (máximo unos 2 minutos)." };

  // `audio/webm;codecs=opus` → `audio/webm`
  const mime = file.type.split(";")[0].trim().toLowerCase();
  const ext = EXTENSIONS[mime];
  if (!ext) return { ok: false, error: "Ese formato de audio no se puede leer. Inténtalo desde otro navegador." };

  client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    // OpenAI decide el formato por la extensión del nombre: se fija aquí.
    const named = new File([await file.arrayBuffer()], `nota.${ext}`, { type: mime });
    const res = await client.audio.transcriptions.create({ file: named, model: TRANSCRIBE_MODEL, language: "es" });
    const text = res.text?.trim();
    if (!text) return { ok: false, error: "No se entendió nada en la nota de voz. Inténtalo de nuevo, más cerca del micrófono." };
    return { ok: true, text };
  } catch (e) {
    console.error("[agent-chat] fallo al transcribir", e);
    return { ok: false, error: "No pudimos transcribir la nota de voz. Inténtalo de nuevo o escribe tu mensaje." };
  }
}
