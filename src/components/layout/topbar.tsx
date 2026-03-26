"use client";

import Link from "next/link";
import type { Session } from "next-auth";
import { LogOut, UserCircle, KeyRound, Menu } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";

const roleLabels = {
  ADMINISTRADOR: "Administrador",
  COLABORADOR: "Colaborador",
  CLIENTE: "Cliente",
};

export function Topbar({
  user,
  unreadCount,
  onMenuClick,
}: {
  user: Session["user"];
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

      {/* Espaciador — solo en desktop */}
      <div className="hidden lg:block" />

      <div className="flex items-center gap-2 sm:gap-3">
        <NotificationBell initialUnreadCount={unreadCount} />
        <ThemeToggle />
        <UserCircle className="w-8 h-8 hidden sm:block" style={{ color: "var(--app-icon-color)" }} />
        {/* Nombre y rol — oculto en móvil */}
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium" style={{ color: "var(--app-body-text)" }}>{user.name}</p>
          <p className="text-xs" style={{ color: "var(--app-text-muted)" }}>{roleLabels[user.role]}</p>
        </div>
        <Link
          href="/perfil"
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          style={{ color: "var(--app-icon-color)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--app-body-text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--app-icon-color)")}
          title="Mi perfil"
        >
          <KeyRound className="w-4 h-4" />
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
