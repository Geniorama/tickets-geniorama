"use server";

import { prisma } from "@/lib/prisma";
import { getRequiredSession } from "@/lib/auth-helpers";
import { authorizeAiTool } from "@/lib/ai-access";
import {
  type AiProvider,
  resolveProvider,
  DEFAULT_AI_PROVIDER,
  providerConfigError,
  runTextCompletion,
} from "@/lib/ai";
import { listComments } from "@/lib/comments";

export async function getTicketDiagnosis(
  ticketId: string,
  provider: AiProvider = DEFAULT_AI_PROVIDER
) {
  const session = await getRequiredSession();
  // Equipo, o cliente con IA en su plan y acceso a este ticket
  const access = await authorizeAiTool(session.user, { type: "TICKET", id: ticketId });
  if ("error" in access) return { error: access.error };

  provider = resolveProvider(provider);
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
    },
  });

  if (!ticket) return { error: "Ticket no encontrado" };

  // Los comentarios viven en la tabla compartida. Las notas internas quedan
  // fuera: este resumen puede compartirse con el cliente.
  const comments = await listComments({
    entityType: "TICKET",
    entityId: ticketId,
    includeInternal: false,
  });

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
    // La documentación y la arquitectura del sitio son internas: en la ficha
    // solo las ve el equipo, y lo que entra al prompt puede salir citado.
    if (!access.client && ticket.site.documentation) {
      prompt += `\n**Documentación del sitio:**\n${ticket.site.documentation}\n`;
    }
    if (!access.client && ticket.site.architecture) {
      prompt += `\n**Arquitectura:**\n${ticket.site.architecture}\n`;
    }
  }

  if (comments.length > 0) {
    prompt += `\n---\n**Historial de comentarios:**\n`;
    for (const c of comments) {
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
