"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Entrega al iframe del widget el resultado del inicio de sesión y se cierra.
 * El mensaje va dirigido al origen de la plataforma (`targetOrigin`), así que
 * solo lo recibe el iframe del widget, nunca la página que lo inserta.
 */
export function EmbedConnect({
  nonce, token, name, reason, switchUrl,
}: {
  nonce: string | null;
  token: string | null;
  name: string;
  reason: string | null;
  switchUrl: string;
}) {
  const [delivered, setDelivered] = useState<boolean | null>(null);

  useEffect(() => {
    const opener = window.opener as Window | null;
    if (!opener || !nonce) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDelivered(false);
      return;
    }
    opener.postMessage(
      token ? { type: "geniorama-agent-auth", nonce, token } : { type: "geniorama-agent-auth", nonce, reason },
      window.location.origin,
    );
    setDelivered(true);
    // Si hay un motivo que leer, la ventana se queda abierta para mostrarlo.
    if (token) {
      const t = setTimeout(() => window.close(), 900);
      return () => clearTimeout(t);
    }
  }, [nonce, token, reason]);

  const ok = Boolean(token) && delivered !== false;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", backgroundColor: "#f0f4ff", color: "#1a1a3e" }}>
      <div style={{ maxWidth: "22rem", width: "100%", textAlign: "center", backgroundColor: "#ffffff", borderRadius: "1rem", border: "1px solid rgba(0,10,61,0.1)", padding: "1.75rem 1.5rem" }}>
        {ok
          ? <CheckCircle2 style={{ width: "2rem", height: "2rem", color: "#16a34a", margin: "0 auto 0.75rem" }} />
          : <AlertCircle style={{ width: "2rem", height: "2rem", color: "#d97706", margin: "0 auto 0.75rem" }} />}
        <p style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>
          {ok ? `Listo, ${name.split(" ")[0]}` : token ? "No se pudo conectar" : "El asistente no está disponible"}
        </p>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "rgba(0,10,61,0.6)", lineHeight: 1.6 }}>
          {ok
            ? "Ya puedes volver al chat. Esta ventana se cierra sola."
            : token
              ? "Abre esta ventana desde el botón «Iniciar sesión» del chat e inténtalo de nuevo."
              : reason}
        </p>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "rgba(0,10,61,0.5)" }}>
          Entraste como {name}. <a href={switchUrl} style={{ color: "#fd1384" }}>Usar otra cuenta</a>
        </p>
      </div>
    </div>
  );
}
