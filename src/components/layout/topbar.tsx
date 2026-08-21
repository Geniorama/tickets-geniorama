"use client";

import Link from "next/link";
import Image from "next/image";
import type { Session } from "next-auth";
import { LogOut, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import { GlobalSearch } from "@/components/layout/global-search";
import { TourHelpButton } from "@/components/tour/tour-help-button";

const roleLabels = {
  ADMINISTRADOR: "Administrador",
  COLABORADOR: "Colaborador",
  CLIENTE: "Cliente",
};

// Iniciales: primera letra del primer y último nombre (o solo la primera).
function getInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function Topbar({
  user,
  avatarUrl,
  unreadCount,
  onMenuClick,
}: {
  user: Session["user"];
  avatarUrl?: string | null;
  unreadCount: number;
  onMenuClick?: () => void;
}) {
  return (
    <header
      className="h-14 flex items-center justify-between px-4 lg:px-6"
      style={{
        backgroundColor: "var(--app-header-bg)",
        borderBottom: "1px solid var(--app-border)",
      }}
    >
      {/* Botón hamburguesa — solo en móvil */}
      <button
        className="lg:hidden p-2 rounded-lg transition-colors"
        onClick={onMenuClick}
        aria-label="Abrir menú"
        style={{ color: "var(--app-icon-color)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--app-body-text)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--app-icon-color)")}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* El buscador ocupa el hueco que antes era espaciador: con la app
          partida en módulos, es el atajo para llegar a algo sin acordarse de
          en cuál vive. */}
      <div data-tour-id="search" className="flex items-center flex-1 min-w-0 px-3 lg:pl-0 lg:pr-6">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <TourHelpButton />
        <span data-tour-id="notifications" className="flex items-center">
          <NotificationBell initialUnreadCount={unreadCount} />
        </span>
        <span data-tour-id="theme" className="flex items-center">
          <ThemeToggle />
        </span>
        {/* Avatar + nombre: link a la página de perfil */}
        <Link
          href="/perfil"
          data-tour-id="profile"
          className="flex items-center gap-2 sm:gap-3 rounded-lg px-1 py-1 transition-colors"
          style={{ color: "var(--app-icon-color)", textDecoration: "none" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--app-body-text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--app-icon-color)")}
          title="Mi perfil"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={user.name ?? "Avatar"}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ backgroundColor: "rgba(253,19,132,0.12)", color: "#fd1384" }}
              aria-hidden="true"
            >
              {getInitials(user.name)}
            </span>
          )}
          {/* Nombre y rol — oculto en móvil */}
          <span className="text-right hidden sm:block">
            <span className="block text-sm font-medium" style={{ color: "var(--app-body-text)" }}>{user.name}</span>
            <span className="block text-xs" style={{ color: "var(--app-text-muted)" }}>{roleLabels[user.role]}</span>
          </span>
        </Link>
        {/* Botón logout: pausa timers activos antes de navegar a /api/logout */}
        <button
          onClick={async () => {
            try {
              await fetch("/api/timer/pause-all", { method: "POST", credentials: "include" });
            } catch { /* ignorar — el logout procede igual */ }
            window.location.href = "/api/logout";
          }}
          className="flex items-center gap-1.5 text-sm transition-colors cursor-pointer"
          style={{ color: "var(--app-text-muted)", background: "none", border: "none", padding: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fd1384")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--app-text-muted)")}
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  );
}
