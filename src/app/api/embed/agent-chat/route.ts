import { NextResponse } from "next/server";
import { loadAgentChat, sendAgentChat, verifyEmbedToken } from "@/lib/agent-chat-session";

/**
 * El chat del widget insertado en otros sitios.
 *
 *   GET  /api/embed/agent-chat                      → estado y última conversación
 *   POST /api/embed/agent-chat { conversationId, message }
 *
 * Lo llama solo el iframe del widget, que vive en este mismo dominio, así que
 * no hace falta CORS. Se autentica con el token del widget
 * (`Authorization: Bearer …`, ver `issueEmbedToken`), no con la sesión: dentro
 * de un iframe en otro sitio la cookie no llega. Un 401 le dice al widget que
 * vuelva a pedir el inicio de sesión.
 */

export const dynamic = "force-dynamic";

function userFrom(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  return verifyEmbedToken(header.replace(/^Bearer\s+/i, ""));
}

const unauthorized = () => NextResponse.json({ error: "Inicia sesión de nuevo." }, { status: 401 });

export async function GET(req: Request) {
  const userId = userFrom(req);
  if (!userId) return unauthorized();
  return NextResponse.json(await loadAgentChat(userId), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const userId = userFrom(req);
  if (!userId) return unauthorized();
  const body = (await req.json().catch(() => null)) as { conversationId?: unknown; message?: unknown } | null;
  if (!body || typeof body.message !== "string") {
    return NextResponse.json({ error: "Falta el mensaje." }, { status: 400 });
  }
  const conversationId = typeof body.conversationId === "string" && body.conversationId ? body.conversationId : null;
  return NextResponse.json(await sendAgentChat(userId, conversationId, body.message));
}
