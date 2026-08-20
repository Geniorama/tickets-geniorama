import { authenticateApiKey, isAuthFailure } from "@/lib/api/keys";
import { apiError, apiOk } from "@/lib/api/respond";

/**
 * Comprobación de llave.
 *
 * Es el primer endpoint que llama cualquiera al integrar: dice si el token vale,
 * en nombre de quién escribe y qué permisos tiene. Sin esto, un 403 más adelante
 * no distingue entre «la llave está mal» y «te falta un permiso».
 */

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const actor = await authenticateApiKey(req);
  if (isAuthFailure(actor)) return apiError(actor.error, actor.status);

  return apiOk({
    key: { id: actor.keyId, label: actor.keyLabel, scopes: actor.scopes },
    user: actor.user,
  });
}
