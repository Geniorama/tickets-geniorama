import { NextResponse } from "next/server";
import { apiError, apiOk, requireAgentActor } from "@/lib/api/respond";
import { agentSiteDiagnosis, requireAgentClient } from "@/lib/api/agent";

/**
 * Agente · ¿por qué no carga mi sitio?
 *
 *   GET /api/v1/agent/sites/:id/diagnose?client=<token de /agent/client>
 *
 * Comprueba el sitio en vivo —DNS, certificado y respuesta HTTP— y lo cruza con
 * los vencimientos de dominio, hosting y SSL de la empresa y con los tickets ya
 * abiertos sobre ese sitio. `findings` trae las conclusiones en español, de la
 * más grave a la menos; vacío (`looksHealthy: true`) si desde fuera todo va bien.
 *
 * No incluye la documentación ni la arquitectura de la ficha: son del equipo,
 * a veces traen accesos, y el agente conversa con el cliente. Tapar las
 * credenciales con un filtro deja pasar las que no tienen la forma esperada.
 */

export const dynamic = "force-dynamic";
// Las comprobaciones de red pueden tardar unos segundos.
export const maxDuration = 30;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireAgentActor(req);
  if (actor instanceof NextResponse) return actor;

  const client = await requireAgentClient(actor.keyId, new URL(req.url).searchParams.get("client"));
  if (!client.ok) return apiError(client.error, client.status);

  const { id } = await params;
  const diagnosis = await agentSiteDiagnosis(client.value, id);
  if (!diagnosis) return apiError("Ese sitio no es de este cliente", 404);
  return apiOk({ diagnosis });
}
