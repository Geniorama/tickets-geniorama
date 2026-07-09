import Image from "next/image";
import { CalendarClock, ExternalLink } from "lucide-react";
import type { SchedulingLinkData } from "@/lib/scheduling";

// Tarjeta presentacional de un colaborador con su bio y sus links de agendamiento
// (ya filtrados por categoría por quien la usa). Se muestra a clientes en /agendar
// y, embebida, en el detalle de proyecto (gestor) y de ticket (agente).
export function SchedulingCard({
  name,
  cargo,
  bio,
  links,
  avatarUrl,
  compact = false,
}: {
  name: string;
  cargo?: string | null;
  bio?: string | null;
  links: SchedulingLinkData[];
  avatarUrl?: string | null;
  compact?: boolean;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      style={{
        backgroundColor: "var(--app-card-bg)",
        border: "1px solid var(--app-border)",
        borderRadius: "0.75rem",
        padding: compact ? "1rem" : "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            width: "2.75rem",
            height: "2.75rem",
            borderRadius: "9999px",
            overflow: "hidden",
            flexShrink: 0,
            position: "relative",
            backgroundColor: "var(--app-content-bg)",
            border: "1px solid var(--app-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {avatarUrl ? (
            <Image src={avatarUrl} alt={name} fill sizes="44px" style={{ objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--app-text-muted)" }}>{initial}</span>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--app-body-text)", margin: 0 }}>{name}</p>
          {cargo && (
            <p style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", margin: "0.125rem 0 0" }}>{cargo}</p>
          )}
        </div>
      </div>

      {bio && (
        <p style={{ fontSize: "0.8125rem", color: "var(--app-body-text)", margin: 0, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
          {bio}
        </p>
      )}

      {links.length > 0 ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.5rem",
                  textDecoration: "none",
                  border: "1px solid rgba(253,19,132,0.35)",
                  borderRadius: "0.5rem",
                  padding: "0.625rem 0.75rem",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                <CalendarClock style={{ width: "1rem", height: "1rem", color: "#fd1384", flexShrink: 0, marginTop: "0.125rem" }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", fontWeight: 600, color: "#fd1384" }}>
                    {link.title}
                    <ExternalLink style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0 }} />
                  </span>
                  {link.description && (
                    <span style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.125rem" }}>
                      {link.description}
                    </span>
                  )}
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", margin: 0, fontStyle: "italic" }}>
          Sin links de agendamiento disponibles.
        </p>
      )}
    </div>
  );
}
