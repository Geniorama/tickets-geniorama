"use client";

import { signOut } from "next-auth/react";
import type { Session } from "next-auth";
import { LogOut, UserCircle } from "lucide-react";

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
        backgroundColor: "#000a3d",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div />
      <div className="flex items-center gap-4">
        <UserCircle className="w-8 h-8" style={{ color: "rgba(255,255,255,0.25)" }} />
        <div className="text-right">
          <p className="text-sm font-medium" style={{ color: "#ffffff" }}>{user.name}</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{roleLabels[user.role]}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 text-sm transition-colors ml-2"
          style={{ color: "rgba(255,255,255,0.45)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fd1384")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.45)")}
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
          <span>Salir</span>
        </button>
      </div>
    </header>
  );
}
