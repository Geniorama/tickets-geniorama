import { NextResponse } from "next/server";
import { sendAgentChatAudio, verifyEmbedToken } from "@/lib/agent-chat-session";
import { MAX_AUDIO_BYTES } from "@/lib/agent-chat-audio";

/**
 * Notas de voz del widget insertado en otros sitios.
 *
 *   POST /api/embed/agent-chat/audio   (multipart: audio, conversationId?)
 *
 * Igual que `/api/embed/agent-chat`: se autentica con el token del widget.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const userId = verifyEmbedToken(header.replace(/^Bearer\s+/i, ""));
  if (!userId) return NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });

  // Antes de leer el cuerpo: un archivo enorme no debe llegar a memoria.
  if (Number(req.headers.get("content-length") ?? 0) > MAX_AUDIO_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "La nota de voz es muy larga (máximo unos 2 minutos)." });
  }
  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof File)) return NextResponse.json({ error: "No llegó la nota de voz." }, { status: 400 });
  const conversationId = form?.get("conversationId");
  return NextResponse.json(
    await sendAgentChatAudio(userId, typeof conversationId === "string" && conversationId ? conversationId : null, audio),
  );
}
