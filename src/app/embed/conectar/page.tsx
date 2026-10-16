import { getRequiredSession } from "@/lib/auth-helpers";
import { loadAgentChat, issueEmbedToken } from "@/lib/agent-chat-session";
import { EmbedConnect } from "@/components/agent-chat/embed-connect";

export const metadata = { title: "Conectar el asistente" };
export const dynamic = "force-dynamic";

/**
 * La ventana que abre el widget para que la persona entre con su cuenta. Pasa
 * por el login normal de la plataforma (el middleware la manda a /login y
 * vuelve aquí) y le devuelve al iframe un token firmado por `postMessage`,
 * dirigido solo al origen de la plataforma: una página ajena que abra esta
 * ventana no recibe nada.
 *
 * Si la cuenta no puede usar el asistente (es del equipo o su plan no lo
 * incluye) no se emite token: se le devuelve el motivo para que el widget lo
 * muestre.
 */
export default async function EmbedConectarPage({ searchParams }: { searchParams: Promise<{ nonce?: string }> }) {
  const session = await getRequiredSession();
  const { nonce } = await searchParams;
  const validNonce = nonce && /^[\w-]{8,64}$/.test(nonce) ? nonce : null;

  const state = await loadAgentChat(session.user.id);
  const token = state.available ? issueEmbedToken(session.user.id) : null;

  return (
    <EmbedConnect
      nonce={validNonce}
      token={token}
      name={session.user.name ?? session.user.email ?? ""}
      reason={state.available ? null : state.reason}
      switchUrl={`/api/logout?callbackUrl=${encodeURIComponent(`/embed/conectar${validNonce ? `?nonce=${validNonce}` : ""}`)}`}
    />
  );
}
