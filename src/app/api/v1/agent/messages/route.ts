import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, readJson, requireAgentActor } from "@/lib/api/respond";
import { phoneToE164, recentHistory, saveMessage } from "@/lib/api/agent-messages";
import { prisma } from "@/lib/prisma";
import { notifyMany } from "@/lib/notify";

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
 *
 * `error` (solo con `assistant`) marca que el agente falló y el cliente recibió
 * el mensaje de respaldo: se guarda y se avisa a los administradores con un
 * enlace a la conversación.
 */

export const dynamic = "force-dynamic";

const schema = z.object({
  phone: z.string().trim().min(1, "phone es requerido"),
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1, "content es requerido").max(8000),
  waMessageId: z.string().trim().max(200).optional(),
  history: z.number().int().min(0).max(50).default(0),
  error: z.string().trim().max(2000).optional(),
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
    error: parsed.data.role === "assistant" ? parsed.data.error : null,
  });

  if (parsed.data.role === "assistant" && parsed.data.error && !saved.duplicate) {
    void avisarFalla(p.e164, owners.length === 1 ? owners[0].id : null, parsed.data.error);
  }

  return apiOk(
    {
      id: saved.id,
      duplicate: saved.duplicate,
      ...(parsed.data.history > 0 ? { history: await recentHistory(p.e164, parsed.data.history) } : {}),
    },
    saved.duplicate ? 200 : 201,
  );
}

/** Avisa a los administradores; no frena la respuesta al flujo de n8n. */
async function avisarFalla(phone: string, clientId: string | null, error: string) {
  try {
    const [admins, client] = await Promise.all([
      prisma.user.findMany({ where: { role: "ADMINISTRADOR", isActive: true }, select: { id: true } }),
      clientId ? prisma.user.findUnique({ where: { id: clientId }, select: { name: true } }) : null,
    ]);
    const quien = client?.name ? `${client.name} (${phone})` : phone;
    await notifyMany(
      admins.map((a) => a.id),
      "agent_failure",
      "El agente de WhatsApp no pudo responder",
      `${quien} recibió el mensaje de respaldo. Motivo: ${error.slice(0, 300)}`,
      `/admin/conversaciones?c=${encodeURIComponent(`wa:${phone}`)}`,
    );
  } catch {
    // El aviso no debe tumbar el guardado.
  }
}
