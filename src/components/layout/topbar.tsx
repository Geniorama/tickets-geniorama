"use client";

import Link from "next/link";
import type { Session } from "next-auth";
import { LogOut, UserCircle, KeyRound } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const roleLabels = {
  ADMINISTRADOR: "Administrador",
  COLABORADOR: "Colaborador",
  CLIENTE: "Cliente",
};

export function Topbar({ user }: { user: Session["user"] }) {
  return (
    <header
      className="h-14 flex items-center justify-between px-6"
      style={{
        backgroundColor: "var(--app-header-bg)",
        borderBottom: "1px solid var(--app-border)",
      }}
    >
      <div />
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <UserCircle className="w-8 h-8" style={{ color: "var(--app-icon-color)" }} />
        <div className="text-right">
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
        {/* Usar <a> nativo para garantizar navegación completa sin intercepción del router de React */}
        <a
          href="/api/logout"
          className="flex items-center gap-1.5 text-sm transition-colors ml-1 cursor-pointer"
          style={{ color: "var(--app-text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fd1384")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--app-text-muted)")}
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
          <span>Salir</span>
        </a>
      </div>
    </header>
  );
}
