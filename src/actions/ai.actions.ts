"use server";

import { prisma } from "@/lib/prisma";
import { getRequiredSession, isStaff } from "@/lib/auth-helpers";
import {
  type AiProvider,
  isValidProvider,
  providerConfigError,
  runTextCompletion,
} from "@/lib/ai";

export async function getTicketDiagnosis(
  ticketId: string,
  provider: AiProvider = "gemini"
) {
  const session = await getRequiredSession();
  if (!isStaff(session.user.role)) return { error: "Sin permisos" };

  if (!isValidProvider(provider)) provider = "gemini";
  const cfgErr = providerConfigError(provider);
  if (cfgErr) return { error: cfgErr };

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      title: true,
      description: true,
      priority: true,
      category: true,
      site: {
        select: { name: true, domain: true, documentation: true, architecture: true },
      },
      comments: {
        where: { isInternal: false },
        orderBy: { createdAt: "asc" },
        select: { body: true, author: { select: { name: true, role: true } } },
      },
    },
  });

  if (!ticket) return { error: "Ticket no encontrado" };

  const priorityLabel: Record<string, string> = {
    BAJA: "Baja", MEDIA: "Media", ALTA: "Alta", CRITICA: "Crítica",
  };

  let prompt = `Eres un asistente técnico especializado en soporte y desarrollo web.

Analiza la siguiente incidencia y proporciona:
1. **Diagnóstico** — qué está pasando y por qué
2. **Posibles causas** — lista ordenada de más a menos probable
3. **Soluciones recomendadas** — pasos concretos para resolver el problema

---

**Ticket:** ${ticket.title}
**Prioridad:** ${priorityLabel[ticket.priority] ?? ticket.priority}${ticket.category ? `\n**Categoría:** ${ticket.category}` : ""}

**Descripción:**
${ticket.description}
`;

  if (ticket.site) {
    prompt += `\n---\n**Sitio/app afectado:** ${ticket.site.name} (${ticket.site.domain})\n`;
    if (ticket.site.documentation) {
      prompt += `\n**Documentación del sitio:**\n${ticket.site.documentation}\n`;
    }
    if (ticket.site.architecture) {
      prompt += `\n**Arquitectura:**\n${ticket.site.architecture}\n`;
    }
  }

  if (ticket.comments.length > 0) {
    prompt += `\n---\n**Historial de comentarios:**\n`;
    for (const c of ticket.comments) {
      prompt += `- ${c.author.name}: ${c.body}\n`;
    }
  }

  prompt += `\n---\nResponde en español de forma clara y estructurada. Sé concreto y práctico.`;

  try {
    const text = await runTextCompletion({ provider, prompt });
    return { text };
  } catch (err) {
    console.error(`${provider} error:`, err);
    return { error: "Error al contactar el servicio de IA. Verifica la configuración." };
  }
}
