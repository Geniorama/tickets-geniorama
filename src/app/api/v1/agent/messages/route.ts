import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, readJson, requireAgentActor } from "@/lib/api/respond";
import { phoneToE164, recentHistory, saveMessage } from "@/lib/api/agent-messages";
import { prisma } from "@/lib/prisma";

/**
 * Agente · guardar un mensaje de la conversación.
 *
 *   POST /api/v1/agent/messages
 *   { "phone": "573118364663", "role": "user" | "assistant", "content": "...", "waMessageId": "wamid..." }
 *
 * `user` es lo que escribió el cliente (entrante) y `assistant` lo que contestó
 * el agente (saliente). Con `waMessageId` es idempotente: si Meta reintenta el
 * webhook responde `duplicate: true` sin guardar de nuevo. Con `history` > 0
 * devuelve además los últimos mensajes.
 */

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().trim().min(1, "phone es requerido"),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1, "content es requerido").max(8000),
  waMessageId: z.string().trim().max(200).optional(),
  history: z.number().int().min(0).max(50).default(0),
});

export async function POST(req: Request) {
  const actor = await requireAgentActor(req);
  if (actor instanceof NextResponse) return actor;

  const body = await readJson(req);
  if (body instanceof NextResponse) return body;
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0].message, 400, { issues: parsed.error.issues });

  const p = phoneToE164(parsed.data.phone);
  if (!p.ok) return apiError(`Teléfono no válido: ${p.error}`, 400, { code: "invalid" });

  // Si hay una sola cuenta con ese número, el mensaje queda ligado a ella.
  const owners = await prisma.user.findMany({
    where: { whatsappPhone: p.e164, role: "CLIENTE", isActive: true }, select: { id: true }, take: 2,
  });

  const saved = await saveMessage({
    phone: p.e164,
    direction: parsed.data.role === "user" ? "IN" : "OUT",
    content: parsed.data.content,
    waMessageId: parsed.data.waMessageId,
    clientId: owners.length === 1 ? owners[0].id : null,
  });

  return apiOk(
    {
      id: saved.id,
      duplicate: saved.duplicate,
      ...(parsed.data.history > 0 ? { history: await recentHistory(p.e164, parsed.data.history) } : {}),
    },
    saved.duplicate ? 200 : 201,
  );
}
