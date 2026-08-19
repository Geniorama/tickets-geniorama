"use server";

import { prisma } from "@/lib/prisma";
import { requireCan } from "@/lib/access/can";
import { revalidatePath } from "next/cache";
import { AGENT_PROMPT_KEY, AGENT_PROMPT_MAX_CHARS } from "@/lib/whatsapp/prompt";

/**
 * Edición del prompt del agente de WhatsApp desde el panel.
 *
 * Se valida en el servidor, no solo en el formulario: un prompt vacío dejaría
 * al modelo sin ninguna instrucción —contestaría cualquier cosa a los
 * clientes— y uno desmedido se paga en latencia y tokens en cada mensaje.
 */

export async function saveAgentPrompt(value: string): Promise<{ error?: string }> {
  await requireCan("ADMIN");

  const prompt = value.trim();
  if (!prompt) {
    return { error: "Las instrucciones no pueden quedar vacías. Si quieres el texto original, usa «Restaurar el original»." };
  }
  if (prompt.length > AGENT_PROMPT_MAX_CHARS) {
    return { error: `Las instrucciones no pueden pasar de ${AGENT_PROMPT_MAX_CHARS.toLocaleString("es")} caracteres.` };
  }

  try {
    await prisma.appSetting.upsert({
      where: { key: AGENT_PROMPT_KEY },
      update: { value: prompt },
      create: { key: AGENT_PROMPT_KEY, value: prompt },
    });
    revalidatePath("/admin/integraciones");
    return {};
  } catch {
    return { error: "No se pudieron guardar las instrucciones." };
  }
}

/**
 * Vuelve al texto de fábrica borrando la fila: el agente lee
 * `DEFAULT_AGENT_PROMPT` en cuanto no encuentra nada guardado.
 */
export async function resetAgentPrompt(): Promise<{ error?: string }> {
  await requireCan("ADMIN");
  try {
    await prisma.appSetting.deleteMany({ where: { key: AGENT_PROMPT_KEY } });
    revalidatePath("/admin/integraciones");
    return {};
  } catch {
    return { error: "No se pudieron restaurar las instrucciones originales." };
  }
}
