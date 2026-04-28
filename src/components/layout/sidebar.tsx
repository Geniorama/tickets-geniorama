"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { Role } from "@/generated/prisma";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Ticket, Building2, Users, BookOpen, CreditCard,
  BarChart3, FolderKanban, ListTodo, TrendingUp, ChevronDown, Server as ServerIcon, Globe, KeyRound, Plug, Sparkles,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";

type NavChild = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: readonly string[];
};

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: readonly string[];
  children?: NavChild[];
};

const navItems: NavItem[] = [
  { href: "/dashboard",          label: "Dashboard",     icon: LayoutDashboard, roles: ["ADMINISTRADOR", "COLABORADOR", "CLIENTE"] },
  {
    href: "/tickets",            label: "Tickets",        icon: Ticket,          roles: ["ADMINISTRADOR", "COLABORADOR", "CLIENTE"],
    children: [
      { href: "/reportes",       label: "Reportes",       icon: BarChart3,       roles: ["ADMINISTRADOR", "COLABORADOR", "CLIENTE"] },
    ],
  },
  {
    href: "/proyectos",          label: "Proyectos",      icon: FolderKanban,    roles: ["ADMINISTRADOR", "COLABORADOR", "CLIENTE"],
    children: [
      { href: "/proyectos/reportes", label: "Reportes",   icon: BarChart3,       roles: ["ADMINISTRADOR", "COLABORADOR", "CLIENTE"] },
    ],
  },
  { href: "/tareas",             label: "Tareas",         icon: ListTodo,        roles: ["ADMINISTRADOR", "COLABORADOR"] },
  { href: "/boveda",             label: "Bóveda",         icon: KeyRound,        roles: ["ADMINISTRADOR", "COLABORADOR", "CLIENTE"] },
  { href: "/mis-empresas",       label: "Mis empresas",   icon: Building2,       roles: ["CLIENTE"] },
  { href: "/mis-planes",         label: "Mis planes",     icon: CreditCard,      roles: ["CLIENTE"] },
  { href: "/mis-servicios",      label: "Mis servicios",  icon: ServerIcon,      roles: ["CLIENTE"] },
  { href: "/admin/companies",    label: "Empresas",       icon: Building2,       roles: ["ADMINISTRADOR"] },
  { href: "/admin/sitios",       label: "Sitios y apps",  icon: Globe,           roles: ["ADMINISTRADOR", "COLABORADOR"] },
  { href: "/admin/servicios",    label: "Servicios",      icon: ServerIcon,      roles: ["ADMINISTRADOR"] },
  { href: "/admin/users",        label: "Usuarios",       icon: Users,           roles: ["ADMINISTRADOR"] },
  { href: "/admin/estadisticas", label: "Productividad",  icon: TrendingUp,      roles: ["ADMINISTRADOR"] },
  { href: "/admin/plans",        label: "Planes",         icon: BookOpen,        roles: ["ADMINISTRADOR"] },
  { href: "/admin/integraciones", label: "Integraciones", icon: Plug,            roles: ["ADMINISTRADOR"] },
  { href: "/novedades",           label: "Novedades",     icon: Sparkles,        roles: ["ADMINISTRADOR", "COLABORADOR", "CLIENTE"] },
];

const LOGO_DARK  = "https://i.imgur.com/pTemb33.png";
const LOGO_LIGHT = "https://i.imgur.com/BFg780c.png";

export function Sidebar({
  role,
  isOpen = false,
  onClose,
  collapsed = false,
  onToggleCollapsed,
}: {
  role: Role;
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname  = usePathname();
  const { theme } = useTheme();
  const [mounted, setMounted]         = useState(false);
  const [openMenus, setOpenMenus]     = useState<Record<string, boolean>>({});

  useEffect(() => setMounted(true), []);

  // Auto-open parent if a child is active
  useEffect(() => {
    const auto: Record<string, boolean> = {};
    for (const item of navItems) {
      if (item.children?.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"))) {
        auto[item.href] = true;
      }
    }
    setOpenMenus((prev) => ({ ...prev, ...auto }));
  }, [pathname]);

  const logoSrc = mounted && theme === "light" ? LOGO_LIGHT : LOGO_DARK;

  function toggle(href: string) {
    setOpenMenus((prev) => ({ ...prev, [href]: !prev[href] }));
  }

  const visible = (item: NavItem | NavChild) =>
    (item.roles as readonly string[]).includes(role);

  return (
    <aside
      className={cn(
        "w-60 flex flex-col shrink-0 transition-all duration-300 ease-in-out",
        // Mobile: overlay fijo, se desliza desde la izquierda
        "fixed inset-y-0 left-0 z-40",
        // Desktop: vuelve al flujo normal del documento
        "lg:static lg:inset-auto lg:z-auto lg:translate-x-0",
        // Visibilidad en móvil controlada por isOpen
        !isOpen && "-translate-x-full lg:translate-x-0",
        // Colapso solo en desktop
        collapsed && "lg:w-16",
      )}
      style={{ backgroundColor: "var(--app-sidebar-bg)" }}
    >
      {/* Logo */}
      <div
        className={cn(
          "h-14 flex items-center justify-between",
          collapsed ? "px-3 lg:px-2 lg:justify-center" : "px-5",
        )}
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
        {/* Botón cerrar — solo en móvil */}
        <button
          className="lg:hidden p-1 rounded-lg"
          onClick={onClose}
          aria-label="Cerrar menú"
          style={{ color: "var(--app-icon-color)" }}
        >
          ✕
        </button>
      </div>

      {/* Nav */}
      <nav className={cn("flex-1", collapsed ? "p-3 lg:p-2" : "p-3")}>
        <ul className="space-y-1">
          {navItems.filter(visible).map((item) => {
            const Icon         = item.icon;
            const visibleKids  = item.children?.filter(visible) ?? [];
            const hasChildren  = visibleKids.length > 0;
            const parentActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const childActive  = visibleKids.some((c) => pathname === c.href || pathname.startsWith(c.href + "/"));
            const isOpen       = openMenus[item.href] ?? false;

            // Parent is "highlighted" only when on its own route (not a child's)
            const selfActive = parentActive && !childActive;

            return (
              <li key={item.href}>
                {/* Parent row */}
                <div className="flex items-stretch">
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex-1",
                      collapsed && "lg:justify-center lg:px-2 lg:gap-0",
                    )}
                    style={selfActive ? { backgroundColor: "#fd1384", color: "#ffffff" } : { color: "var(--app-nav-text)" }}
                    onClick={onClose}
                    onMouseEnter={(e) => {
                      if (!selfActive) {
                        e.currentTarget.style.backgroundColor = "var(--app-nav-hover-bg)";
                        e.currentTarget.style.color = "var(--app-body-text)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selfActive) {
                        e.currentTarget.style.backgroundColor = "transparent";
                        e.currentTarget.style.color = "var(--app-nav-text)";
                      }
                    }}
                  >
                    <Icon
                      className="w-4 h-4 shrink-0"
                      style={{ color: selfActive ? "#ffffff" : "var(--app-icon-color)" }}
                    />
                    <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
                  </Link>

                  {/* Chevron toggle */}
                  {hasChildren && (
                    <button
                      onClick={() => toggle(item.href)}
                      aria-label="Expandir"
                      className={cn(
                        "flex items-center rounded-lg",
                        collapsed && "lg:hidden",
                      )}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "0 0.5rem",
                        color: "var(--app-icon-color)",
                        transition: "color 0.15s",
                      }}
                    >
                      <ChevronDown
                        className="w-3.5 h-3.5"
                        style={{
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s",
                        }}
                      />
                    </button>
                  )}
                </div>

                {/* Children — ocultos cuando el sidebar está colapsado en desktop */}
                {hasChildren && isOpen && (
                  <ul
                    className={cn(
                      "flex flex-col gap-0.5 mt-0.5 ml-4 pl-3",
                      collapsed && "lg:hidden",
                    )}
                    style={{
                      borderLeft: "1px solid var(--app-border)",
                    }}
                  >
                    {visibleKids.map((child) => {
                      const ChildIcon   = child.icon;
                      const childActive = pathname === child.href || pathname.startsWith(child.href + "/");
                      return (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className={cn("flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all")}
                            style={childActive ? { backgroundColor: "#fd1384", color: "#ffffff" } : { color: "var(--app-nav-text)" }}
                            onClick={onClose}
                            onMouseEnter={(e) => {
                              if (!childActive) {
                                e.currentTarget.style.backgroundColor = "var(--app-nav-hover-bg)";
                                e.currentTarget.style.color = "var(--app-body-text)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!childActive) {
                                e.currentTarget.style.backgroundColor = "transparent";
                                e.currentTarget.style.color = "var(--app-nav-text)";
                              }
                            }}
                          >
                            <ChildIcon
                              className="w-3.5 h-3.5 shrink-0"
                              style={{ color: childActive ? "#ffffff" : "var(--app-icon-color)" }}
                            />
                            {child.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Toggle colapso (solo desktop) */}
      {onToggleCollapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          title={collapsed ? "Expandir menú" : "Colapsar menú"}
          className="hidden lg:flex items-center gap-2 px-3 py-2 mx-3 mb-2 rounded-lg text-xs font-medium transition-colors"
          style={{ color: "var(--app-nav-text)", backgroundColor: "transparent", border: "none", cursor: "pointer", justifyContent: collapsed ? "center" : "flex-start" }}
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
      <div
        className={cn("p-4", collapsed && "lg:px-2 lg:py-3")}
        style={{ borderTop: "1px solid var(--app-border)" }}
      >
        <p
          className={cn("text-xs text-center", collapsed && "lg:hidden")}
          style={{ color: "var(--app-footer-text)" }}
        >
          Sistema de Tickets
        </p>
        <p className="text-xs text-center mt-0.5" style={{ color: "var(--app-footer-text)", opacity: 0.5 }}>
          v{process.env.NEXT_PUBLIC_APP_VERSION}
        </p>
      </div>
    </aside>
  );
}
