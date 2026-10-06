import { registerClient } from "@/lib/oauth/server";
import { oauthErrorResponse, oauthJson, preflight } from "@/lib/oauth/http";

/**
 * Registro dinámico de clientes (RFC 7591). Abierto, como pide MCP: registrarse
 * no da acceso a nada. El acceso lo concede cada usuario en la pantalla de
 * autorización, que muestra el nombre de la app y a dónde vuelve.
 */

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const meta = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!meta || typeof meta !== "object") {
      return oauthJson({ error: "invalid_client_metadata", error_description: "El cuerpo debe ser JSON" }, 400);
    }
    return oauthJson(await registerClient(meta), 201);
  } catch (err) {
    return oauthErrorResponse(err);
  }
}

export const OPTIONS = preflight;
