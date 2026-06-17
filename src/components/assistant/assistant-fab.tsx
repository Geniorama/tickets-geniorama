"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import type { Role } from "@/generated/prisma";
import { isStaff } from "@/lib/roles";

/** Botón flotante de acceso rápido al Asistente IA. Solo para staff. */
export function AssistantFab({ role }: { role: Role }) {
  const pathname = usePathname();
  const [hover, setHover] = useState(false);

  // Solo staff y oculto cuando ya estás en el asistente
  if (!isStaff(role)) return null;
  if (pathname === "/asistente" || pathname.startsWith("/asistente/")) return null;

  return (
    <Link
      href="/asistente"
      aria-label="Abrir Asistente IA"
      title="Asistente IA"
      data-tour-id="assistant-fab"
      className="no-print"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 9100,
        display: "flex",
        alignItems: "center",
        gap: hover ? "0.5rem" : "0",
        height: "3.25rem",
        padding: hover ? "0 1.25rem 0 1rem" : "0",
        width: hover ? "auto" : "3.25rem",
        justifyContent: "center",
        borderRadius: "9999px",
        backgroundColor: "#4f46e5",
        color: "#ffffff",
        textDecoration: "none",
        boxShadow: "0 12px 28px rgba(79,70,229,0.45), 0 0 0 1px rgba(79,70,229,0.2)",
        transition: "all 0.2s ease",
        overflow: "hidden",
      }}
    >
      <Sparkles style={{ width: "1.375rem", height: "1.375rem", flexShrink: 0 }} />
      <span
        style={{
          fontSize: "0.875rem",
          fontWeight: 600,
          whiteSpace: "nowrap",
          maxWidth: hover ? "10rem" : "0",
          opacity: hover ? 1 : 0,
          transition: "all 0.2s ease",
        }}
      >
        Asistente IA
      </span>
    </Link>
  );
}
