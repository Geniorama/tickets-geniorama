"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { LayoutGrid, ChevronDown, X } from "lucide-react";
import type { AppKey } from "@/generated/prisma";
import { APP_BY_KEY } from "@/lib/access/apps";
import { APP_ICONS, APP_SECTIONS } from "./nav-config";

/**
 * Selector de módulos.
 *
 * Se abre centrado en pantalla y no dentro del menú: en 240px de ancho las
 * tarjetas quedaban ilegibles. Va por portal a `document.body` porque el
 * `<aside>` aplica un transform, y un `position: fixed` dentro se posicionaría
 * respecto a él en lugar de respecto a la ventana.
 *
 * Solo lista lo concedido: lo que no aparece es porque no se tiene acceso,
 * nunca en gris ni con candado. El CRM sí se muestra, señalado y sin enlace,
 * porque está declarado pero aún no construido.
 */
export function AppLauncher({
  apps,
  activeApp,
  collapsed = false,
}: {
  apps: AppKey[];
  activeApp: AppKey | null;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    // Sin esto, el fondo sigue desplazándose bajo el selector.
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previo;
    };
  }, [open]);

  const active = activeApp ? APP_BY_KEY.get(activeApp) : null;
  const ActiveIcon = activeApp ? APP_ICONS[activeApp] : LayoutGrid;

  const selector = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Elegir módulo"
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
        backgroundColor: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "44rem",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "1.5rem",
          borderRadius: "1rem",
          border: "1px solid var(--app-border)",
          backgroundColor: "var(--app-card-bg)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <h2 style={{ fontSize: "1.0625rem", fontWeight: 700, color: "var(--app-body-text)" }}>
              Módulos
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", marginTop: "0.15rem" }}>
              Elige dónde quieres trabajar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "2rem", height: "2rem", flexShrink: 0,
              borderRadius: "0.5rem", border: "1px solid var(--app-border)",
              backgroundColor: "transparent", color: "var(--app-text-muted)", cursor: "pointer",
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))",
            gap: "0.75rem",
          }}
        >
          {apps.map((key) => {
            const def = APP_BY_KEY.get(key);
            if (!def) return null;
            const Icon = APP_ICONS[key];
            const isActive = key === activeApp;
            // Sin secciones no hay adónde ir: declarado pero no construido.
            const destino = APP_SECTIONS[key]?.[0]?.href;
            const disponible = def.built && !!destino;

            const contenido = (
              <>
                <span
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "2.75rem", height: "2.75rem", flexShrink: 0,
                    borderRadius: "0.65rem",
                    backgroundColor: isActive ? "#fd1384" : "var(--app-nav-hover-bg)",
                    border: isActive ? "none" : "1px solid var(--app-border)",
                  }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: isActive ? "#ffffff" : disponible ? "#fd1384" : "var(--app-text-muted)" }}
                  />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 650, color: "var(--app-body-text)" }}>
                      {def.name}
                    </span>
                    {isActive && (
                      <span style={{
                        fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.04em",
                        textTransform: "uppercase", padding: "0.1rem 0.4rem",
                        borderRadius: "9999px", backgroundColor: "rgba(253,19,132,0.15)", color: "#fd1384",
                      }}>
                        Aquí estás
                      </span>
                    )}
                    {!disponible && (
                      <span style={{
                        fontSize: "0.625rem", fontWeight: 700, letterSpacing: "0.04em",
                        textTransform: "uppercase", padding: "0.1rem 0.4rem",
                        borderRadius: "9999px", backgroundColor: "rgba(245,158,11,0.15)", color: "#b45309",
                      }}>
                        Próximamente
                      </span>
                    )}
                  </span>
                  <span style={{
                    display: "block", fontSize: "0.8125rem", lineHeight: 1.35,
                    color: "var(--app-text-muted)", marginTop: "0.2rem",
                  }}>
                    {def.description}
                  </span>
                </span>
              </>
            );

            const estilo: React.CSSProperties = {
              display: "flex",
              alignItems: "flex-start",
              gap: "0.875rem",
              padding: "1rem",
              borderRadius: "0.75rem",
              textDecoration: "none",
              textAlign: "left",
              border: `1px solid ${isActive ? "#fd1384" : "var(--app-border)"}`,
              backgroundColor: isActive ? "var(--app-nav-hover-bg)" : "transparent",
              opacity: disponible ? 1 : 0.6,
              cursor: disponible ? "pointer" : "default",
              fontFamily: "inherit",
              transition: "border-color 0.15s, background-color 0.15s",
            };

            return disponible ? (
              <Link
                key={key}
                href={destino!}
                onClick={() => setOpen(false)}
                style={estilo}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = "#fd1384";
                    e.currentTarget.style.backgroundColor = "var(--app-nav-hover-bg)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = "var(--app-border)";
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {contenido}
              </Link>
            ) : (
              <div key={key} style={estilo} aria-disabled title="Este módulo aún no está disponible">
                {contenido}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cambiar de módulo"
        aria-haspopup="dialog"
        title={collapsed ? (active?.name ?? "Elegir módulo") : undefined}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "0.625rem",
          padding: collapsed ? "0.6rem" : "0.6rem 0.75rem",
          justifyContent: collapsed ? "center" : "flex-start",
          borderRadius: "0.5rem",
          border: "1px solid var(--app-border)",
          backgroundColor: "var(--app-nav-hover-bg)",
          color: "var(--app-body-text)",
          cursor: "pointer",
          fontSize: "0.875rem",
          fontWeight: 600,
          textAlign: "left",
        }}
      >
        <ActiveIcon className="w-4 h-4 shrink-0" style={{ color: "#fd1384" }} />
        {!collapsed && (
          <>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {active?.name ?? "Elegir módulo"}
            </span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ opacity: 0.7 }} />
          </>
        )}
      </button>

      {mounted && open && createPortal(selector, document.body)}
    </>
  );
}
