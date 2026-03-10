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
  BarChart3, FolderKanban, ListTodo, TrendingUp, ChevronDown, Server as ServerIcon,
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
  { href: "/mis-empresas",       label: "Mis empresas",   icon: Building2,       roles: ["CLIENTE"] },
  { href: "/mis-planes",         label: "Mis planes",     icon: CreditCard,      roles: ["CLIENTE"] },
  { href: "/mis-servicios",      label: "Mis servicios",  icon: ServerIcon,      roles: ["CLIENTE"] },
  { href: "/admin/companies",    label: "Empresas",       icon: Building2,       roles: ["ADMINISTRADOR"] },
  { href: "/admin/servicios",    label: "Servicios",      icon: ServerIcon,      roles: ["ADMINISTRADOR"] },
  { href: "/admin/users",        label: "Usuarios",       icon: Users,           roles: ["ADMINISTRADOR"] },
  { href: "/admin/estadisticas", label: "Productividad",  icon: TrendingUp,      roles: ["ADMINISTRADOR"] },
  { href: "/admin/plans",        label: "Planes",         icon: BookOpen,        roles: ["ADMINISTRADOR"] },
];

const LOGO_DARK  = "https://i.imgur.com/pTemb33.png";
const LOGO_LIGHT = "https://i.imgur.com/BFg780c.png";

export function Sidebar({ role }: { role: Role }) {
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
    <aside className="w-60 flex flex-col" style={{ backgroundColor: "var(--app-sidebar-bg)" }}>
      {/* Logo */}
      <div
        className="h-14 px-5 flex items-center justify-center"
        style={{ borderBottom: "1px solid var(--app-border)" }}
      >
        <Image
          src={logoSrc}
          alt="Geniorama"
          width={160}
          height={48}
          className="object-contain"
          priority
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3">
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
                <div style={{ display: "flex", alignItems: "stretch" }}>
                  <Link
                    href={item.href}
                    className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex-1")}
                    style={selfActive ? { backgroundColor: "#fd1384", color: "#ffffff" } : { color: "var(--app-nav-text)" }}
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
                    {item.label}
                  </Link>

                  {/* Chevron toggle */}
                  {hasChildren && (
                    <button
                      onClick={() => toggle(item.href)}
                      aria-label="Expandir"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "0 0.5rem",
                        color: "var(--app-icon-color)",
                        display: "flex",
                        alignItems: "center",
                        borderRadius: "0.5rem",
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

                {/* Children */}
                {hasChildren && isOpen && (
                  <ul
                    style={{
                      marginTop: "0.125rem",
                      marginLeft: "1rem",
                      paddingLeft: "0.75rem",
                      borderLeft: "1px solid var(--app-border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.125rem",
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

      {/* Footer */}
      <div className="p-4" style={{ borderTop: "1px solid var(--app-border)" }}>
        <p className="text-xs text-center" style={{ color: "var(--app-footer-text)" }}>
          Sistema de Tickets
        </p>
      </div>
    </aside>
  );
}
