"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { Role } from "@/generated/prisma";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Ticket, Building2, Users, BookOpen, CreditCard, BarChart3 } from "lucide-react";

const navItems = [
  { href: "/dashboard",   label: "Dashboard",  icon: LayoutDashboard, roles: ["ADMINISTRADOR", "COLABORADOR", "CLIENTE"] },
  { href: "/tickets",     label: "Tickets",    icon: Ticket,          roles: ["ADMINISTRADOR", "COLABORADOR", "CLIENTE"] },
  { href: "/reportes",    label: "Reportes",   icon: BarChart3,       roles: ["ADMINISTRADOR", "COLABORADOR", "CLIENTE"] },
  { href: "/mis-planes",  label: "Mis planes", icon: CreditCard,      roles: ["CLIENTE"] },
  { href: "/admin/companies", label: "Empresas",  icon: Building2,   roles: ["ADMINISTRADOR"] },
  { href: "/admin/users",     label: "Usuarios",  icon: Users,        roles: ["ADMINISTRADOR"] },
  { href: "/admin/plans",     label: "Planes",    icon: BookOpen,     roles: ["ADMINISTRADOR"] },
] as const;

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();

  const filteredItems = navItems.filter((item) =>
    (item.roles as readonly string[]).includes(role)
  );

  return (
    <aside className="w-60 flex flex-col" style={{ backgroundColor: "#000a3d" }}>
      {/* Logo */}
      <div
        className="p-5 flex items-center justify-center"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <Image
          src="https://i.imgur.com/pTemb33.png"
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
          {filteredItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  )}
                  style={
                    active
                      ? { backgroundColor: "#fd1384", color: "#ffffff" }
                      : { color: "rgba(255,255,255,0.6)" }
                  }
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.07)";
                      e.currentTarget.style.color = "#ffffff";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "rgba(255,255,255,0.6)";
                    }
                  }}
                >
                  <Icon
                    className="w-4 h-4 shrink-0"
                    style={{ color: active ? "#ffffff" : "rgba(255,255,255,0.5)" }}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className="p-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
          Sistema de Tickets
        </p>
      </div>
    </aside>
  );
}
