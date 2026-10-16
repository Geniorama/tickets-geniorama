import { headers } from "next/headers";
import { embedAllowedOrigins } from "@/lib/agent-chat-session";
import { EmbedChat } from "@/components/agent-chat/embed-chat";

export const metadata = { title: "GENIA" };
export const dynamic = "force-dynamic";

const APP_ORIGIN = new URL(process.env.AUTH_URL ?? "http://localhost:3000").origin;

/**
 * El chat que carga el iframe del widget (`/embed/widget.js`) en otros sitios.
 *
 * Solo se muestra dentro de los sitios autorizados en *Integraciones del
 * equipo*. El navegador manda el origen de la página anfitriona en `Referer`
 * (el script fija `referrerpolicy` para que llegue aunque el sitio lo quite);
 * un iframe sin él, o de un sitio que no está en la lista, recibe un aviso en
 * vez del chat. Abrirlo directamente, fuera de un iframe, siempre funciona.
 */
export default async function EmbedAsistentePage() {
  const h = await headers();
  const inIframe = h.get("sec-fetch-dest") === "iframe";

  if (inIframe) {
    let origin: string | null = null;
    try {
      origin = new URL(h.get("referer") ?? "").origin;
    } catch {
      origin = null;
    }
    const allowed = origin === APP_ORIGIN || (origin !== null && (await embedAllowedOrigins()).includes(origin));
    if (!allowed) {
      return (
        <div style={{ height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", textAlign: "center", fontSize: "0.875rem", color: "#1a1a3e", backgroundColor: "#ffffff" }}>
          Este sitio no está autorizado para mostrar a GENIA, el asistente de Geniorama.
        </div>
      );
    }
  }

  return <EmbedChat />;
}
