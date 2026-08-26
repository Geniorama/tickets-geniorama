"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Loader2, Send } from "lucide-react";
import { subscribeToPush, unsubscribeFromPush, sendTestPush } from "@/actions/push.actions";

/**
 * Interruptor de las notificaciones push.
 *
 * Está en el perfil porque lo tiene **todo el mundo**, sea del equipo o
 * cliente: los avisos que ya recibe cada uno son los que le llegarán al
 * dispositivo, ni más ni menos.
 *
 * Se activa por dispositivo, no por persona: el navegador da una suscripción
 * distinta en el móvil y en el portátil, y el permiso lo concede cada uno. Por
 * eso el texto habla de «este dispositivo» y no de la cuenta.
 */

type Estado =
  | "cargando"
  | "no-soportado"      // el navegador no tiene push (Safari viejo, modo privado…)
  | "sin-configurar"    // faltan las claves VAPID en el servidor
  | "bloqueado"         // la persona dijo que no; el navegador no vuelve a preguntar
  | "activo"
  | "inactivo";

/** La clave pública viaja en base64url y el navegador la quiere en bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normal = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normal);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushToggle({ publicKey }: { publicKey: string }) {
  const [estado, setEstado] = useState<Estado>("cargando");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const revisar = useCallback(async () => {
    if (!publicKey) return setEstado("sin-configurar");
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return setEstado("no-soportado");
    }
    if (Notification.permission === "denied") return setEstado("bloqueado");

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setEstado(sub ? "activo" : "inactivo");
    } catch {
      setEstado("inactivo");
    }
  }, [publicKey]);

  useEffect(() => { void revisar(); }, [revisar]);

  async function activar() {
    setError(null);
    setAviso(null);
    setOcupado(true);
    try {
      // El permiso debe pedirse dentro del clic: si se pide al cargar la
      // página, los navegadores lo ignoran y además molesta.
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado(permiso === "denied" ? "bloqueado" : "inactivo");
        return;
      }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      const result = await subscribeToPush({
        endpoint: json.endpoint ?? "",
        p256dh: json.keys?.p256dh ?? "",
        auth: json.keys?.auth ?? "",
        userAgent: navigator.userAgent,
      });

      if (result?.error) {
        await sub.unsubscribe().catch(() => {});
        setError(result.error);
        return;
      }

      setEstado("activo");
      setAviso("Listo. Los avisos llegarán a este dispositivo aunque cierres la pestaña.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo activar en este dispositivo");
    } finally {
      setOcupado(false);
    }
  }

  async function desactivar() {
    setError(null);
    setAviso(null);
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        // Primero el servidor: si se cancela en el navegador y falla el
        // servidor, quedaría una fila mandando avisos a la nada.
        await unsubscribeFromPush(sub.endpoint);
        await sub.unsubscribe().catch(() => {});
      }
      setEstado("inactivo");
      setAviso("Desactivadas en este dispositivo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo desactivar");
    } finally {
      setOcupado(false);
    }
  }

  async function probar() {
    setError(null);
    setAviso(null);
    setOcupado(true);
    const r = await sendTestPush();
    if (r?.error) {
      setError(r.error);
    } else {
      const n = r?.enviados ?? 0;
      setAviso(
        `Aceptado por ${n} ${n === 1 ? "dispositivo" : "dispositivos"}. Si no aparece nada, revisa las notificaciones del sistema para este navegador.` +
          (r?.fallidos ? ` (${r.fallidos} sin entregar)` : ""),
      );
    }
    setOcupado(false);
  }

  const explicacion: Record<Estado, string> = {
    cargando: "Comprobando…",
    "no-soportado": "Este navegador no admite notificaciones push. En iPhone hay que añadir la app a la pantalla de inicio primero.",
    "sin-configurar": "Falta configurar las notificaciones push en el servidor. Avisa a un administrador.",
    bloqueado: "Las bloqueaste en este navegador. Para activarlas hay que permitirlas en los ajustes del sitio, junto a la barra de direcciones.",
    activo: "Activadas en este dispositivo. Recibirás aquí los mismos avisos que ves en la campana.",
    inactivo: "Recibe los avisos en este dispositivo aunque tengas la pestaña cerrada.",
  };

  const puedeActuar = estado === "activo" || estado === "inactivo";

  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)", border: "1px solid var(--app-border)",
        borderRadius: "0.75rem", padding: "1.25rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "0.4rem" }}>
        {estado === "activo"
          ? <Bell style={{ width: "1.05rem", height: "1.05rem", color: "#22c55e" }} />
          : <BellOff style={{ width: "1.05rem", height: "1.05rem", color: "var(--app-text-muted)" }} />}
        <h2 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)" }}>
          Notificaciones en este dispositivo
        </h2>
      </div>

      <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginBottom: "1rem", lineHeight: 1.5 }}>
        {explicacion[estado]}
      </p>

      {aviso && <p style={{ fontSize: "0.8125rem", color: "#16a34a", marginBottom: "0.75rem" }}>{aviso}</p>}
      {error && <p style={{ fontSize: "0.8125rem", color: "#b91c1c", marginBottom: "0.75rem" }}>{error}</p>}

      {puedeActuar && (
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={estado === "activo" ? desactivar : activar}
            disabled={ocupado}
            style={{
              display: "inline-flex", alignItems: "center", gap: "0.4rem",
              padding: "0.5rem 1rem", borderRadius: "0.5rem", border: "none",
              fontSize: "0.875rem", fontWeight: 500,
              backgroundColor: estado === "activo" ? "transparent" : "#fd1384",
              boxShadow: estado === "activo" ? "inset 0 0 0 1px var(--app-border)" : "none",
              color: estado === "activo" ? "var(--app-body-text)" : "#fff",
              cursor: ocupado ? "wait" : "pointer", opacity: ocupado ? 0.6 : 1,
            }}
          >
            {ocupado && <Loader2 style={{ width: "0.9rem", height: "0.9rem" }} />}
            {estado === "activo" ? "Desactivar" : "Activar notificaciones"}
          </button>

          {estado === "activo" && (
            <button
              type="button"
              onClick={probar}
              disabled={ocupado}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                padding: "0.5rem 0.9rem", borderRadius: "0.5rem",
                border: "1px solid var(--app-border)", background: "none",
                fontSize: "0.875rem", color: "var(--app-nav-text)",
                cursor: ocupado ? "wait" : "pointer",
              }}
            >
              <Send style={{ width: "0.85rem", height: "0.85rem" }} />
              Enviar una de prueba
            </button>
          )}
        </div>
      )}
    </div>
  );
}
