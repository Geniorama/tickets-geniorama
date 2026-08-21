"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { AccessLevel, AppKey, Role } from "@/generated/prisma";
import { LEVEL_ORDER } from "@/lib/access/apps";
import { cn } from "@/lib/utils";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { AppLauncher } from "./app-launcher";
import { APP_SECTIONS, ALWAYS_VISIBLE, appForPath, type NavCapability, type NavSection } from "./nav-config";

/** Mismo umbral que `can()` en el servidor. */
const REQUIRED_LEVEL: Record<NavCapability, AccessLevel> = {
  ver: "LECTURA", crear: "MIEMBRO", editar: "MIEMBRO", gestionar: "GESTOR",
};

const LOGO_DARK  = "https://i.imgur.com/pTemb33.png";
const LOGO_LIGHT = "https://i.imgur.com/BFg780c.png";

/**
 * Menú lateral contextual.
 *
 * En vez de una lista plana con todo, muestra el lanzador de módulos arriba,
 * las secciones del módulo activo en medio y las herramientas transversales
 * abajo. Así el menú no crece cuando se añade una app: crece el lanzador.
 *
 * El módulo activo se deduce de la ruta. Las rutas transversales (Bóveda,
 * Agendar…) no lo cambian: entrar a la Bóveda desde Proyectos te deja en
 * Proyectos, para poder volver sin pasar por el lanzador.
 */
export function Sidebar({
  role,
  apps,
  levels,
  isOpen = false,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}: {
  role: Role;
  /** Módulos concedidos, resueltos en servidor por `getAccessibleApps`. */
  apps: AppKey[];
  /** Nivel efectivo por módulo, para no ofrecer enlaces que redirigirían. */
  levels: Partial<Record<AppKey, AccessLevel>>;
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname  = usePathname();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Se recuerda el último módulo visitado para que las páginas transversales
  // no dejen el menú vacío.
  const [lastApp, setLastApp] = useState<AppKey | null>(null);

  useEffect(() => setMounted(true), []);

  const appFromPath = appForPath(pathname);
  // El inicio es la casa: punto neutro desde el que se elige módulo. Volver
  // ahí no deja el menú «pegado» al último sitio donde estuviste.
  const enInicio = pathname === "/dashboard";

  useEffect(() => {
    if (appFromPath && apps.includes(appFromPath)) setLastApp(appFromPath);
    else if (pathname === "/dashboard") setLastApp(null);
  }, [appFromPath, apps, pathname]);

  // Las demás rutas transversales (Bóveda, Agendar…) sí conservan el módulo
  // activo, para poder volver sin pasar por el lanzador.
  const activeApp: AppKey | null = enInicio
    ? null
    : (appFromPath && apps.includes(appFromPath) ? appFromPath : null) ?? lastApp;

  const logoSrc = mounted && theme === "light" ? LOGO_LIGHT : LOGO_DARK;

  const visible = (s: NavSection) => !s.roles || s.roles.includes(role);

  /** Además del rol, el nivel dentro del módulo activo. */
  const permitido = (s: NavSection) => {
    if (!visible(s)) return false;
    if (!s.requires || !activeApp) return true;
    const nivel = levels[activeApp] ?? "SIN_ACCESO";
    return LEVEL_ORDER[nivel] >= LEVEL_ORDER[REQUIRED_LEVEL[s.requires]];
  };

  const sections = (activeApp ? APP_SECTIONS[activeApp] ?? [] : []).filter(permitido);
  const tools = ALWAYS_VISIBLE.filter(visible);

  /**
   * Qué entrada del menú se resalta.
   *
   * Solo una: la del prefijo más largo que case con la ruta. Comparar cada una
   * por su cuenta encendía dos a la vez, porque la raíz de un módulo —`/crm`—
   * es prefijo de todo lo que cuelga de ella, así que «Cuentas» seguía
   * iluminada estando en Contactos.
   */
  const candidatos = [...sections, ...tools]
    .map((s) => s.href)
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length);
  const hrefActivo = candidatos[0] ?? null;

  function renderLink(item: NavSection) {
    const Icon = item.icon;
    const active = item.href === hrefActivo;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          data-tour-id={item.href}
          title={collapsed ? item.label : undefined}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
            collapsed && "lg:justify-center lg:px-2 lg:gap-0",
          )}
          style={active ? { backgroundColor: "#fd1384", color: "#ffffff" } : { color: "var(--app-nav-text)" }}
          onClick={onClose}
          onMouseEnter={(e) => {
            if (!active) {
              e.currentTarget.style.backgroundColor = "var(--app-nav-hover-bg)";
              e.currentTarget.style.color = "var(--app-body-text)";
            }
          }}
          onMouseLeave={(e) => {
            if (!active) {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--app-nav-text)";
            }
          }}
        >
          <Icon className="w-4 h-4 shrink-0" style={{ color: active ? "#ffffff" : "var(--app-icon-color)" }} />
          <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
        </Link>
      </li>
    );
  }

  return (
    <aside
      className={cn(
        "w-60 flex flex-col shrink-0 transition-all duration-300 ease-in-out",
        "fixed inset-y-0 left-0 z-40",
        "lg:static lg:inset-auto lg:z-auto lg:translate-x-0",
        !isOpen && "-translate-x-full lg:translate-x-0",
        collapsed && "lg:w-16",
      )}
      style={{ backgroundColor: "var(--app-sidebar-bg)" }}
    >
      {/* Logo */}
      <div
        className={cn("h-14 flex items-center justify-between", collapsed ? "px-3 lg:px-2 lg:justify-center" : "px-5")}
        style={{ borderBottom: "1px solid var(--app-border)" }}
      >
        <Image
          src={logoSrc}
          alt="Geniorama"
          width={140}
          height={40}
          className={cn("object-contain", collapsed && "lg:hidden")}
          priority
        />
        {collapsed && (
          <span
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold"
            style={{ backgroundColor: "#fd1384", color: "#ffffff" }}
            aria-hidden
          >
            G
          </span>
        )}
        <button
          className="lg:hidden p-1 rounded-lg"
          onClick={onClose}
          aria-label="Cerrar menú"
          style={{ color: "var(--app-icon-color)" }}
        >
          ✕
        </button>
      </div>

      {/* Lanzador de módulos */}
      <div className={cn("px-3 pt-3", collapsed && "lg:px-2")} data-tour-id="app-launcher">
        <AppLauncher apps={apps} activeApp={activeApp} collapsed={collapsed} />
      </div>

      {/* Secciones del módulo activo */}
      <nav className={cn("flex-1 overflow-y-auto", collapsed ? "p-3 lg:p-2" : "p-3")}>
        {sections.length > 0 && (
          <ul className="space-y-1">{sections.map(renderLink)}</ul>
        )}

        {/* Separador y rótulo solo cuando hay secciones encima que separar. */}
        {tools.length > 0 && (
          <>
            {sections.length > 0 && (
              <>
                <div
                  className={cn("mx-3 my-3", collapsed && "lg:mx-1")}
                  style={{ borderTop: "1px solid var(--app-border)" }}
                />
                <p
                  className={cn(
                    "px-3 pb-1.5 text-[0.6875rem] font-bold uppercase tracking-wider",
                    collapsed && "lg:hidden",
                  )}
                  style={{ color: "var(--app-footer-text)" }}
                >
                  Herramientas
                </p>
              </>
            )}
            <ul className="space-y-1">{tools.map(renderLink)}</ul>
          </>
        )}
      </nav>

      {/* Toggle colapso (solo desktop) */}
      {onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="hidden lg:flex items-center gap-2 px-3 py-2 mx-3 mb-2 rounded-lg text-xs font-medium transition-colors"
          style={{
            color: "var(--app-nav-text)", backgroundColor: "transparent", border: "none",
            cursor: "pointer", justifyContent: collapsed ? "center" : "flex-start",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--app-nav-hover-bg)"; e.currentTarget.style.color = "var(--app-body-text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--app-nav-text)"; }}
        >
          {collapsed ? (
            <ChevronsRight className="w-4 h-4" style={{ color: "var(--app-icon-color)" }} />
          ) : (
            <>
              <ChevronsLeft className="w-4 h-4" style={{ color: "var(--app-icon-color)" }} />
              Colapsar
            </>
          )}
        </button>
      )}

      {/* Footer */}
      <div className={cn("p-4", collapsed && "lg:px-2 lg:py-3")} style={{ borderTop: "1px solid var(--app-border)" }}>
        <p className={cn("text-xs text-center", collapsed && "lg:hidden")} style={{ color: "var(--app-footer-text)" }}>
          Sistema de Tickets
        </p>
        <p className="text-xs text-center mt-0.5" style={{ color: "var(--app-footer-text)", opacity: 0.5 }}>
          v{process.env.NEXT_PUBLIC_APP_VERSION}
        </p>
      </div>
    </aside>
  );
}
