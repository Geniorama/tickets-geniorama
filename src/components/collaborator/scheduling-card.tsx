import Image from "next/image";
import { CalendarClock, ExternalLink, Lock } from "lucide-react";
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
  bare = false,
  priorityUnlocked = true,
}: {
  name: string;
  cargo?: string | null;
  bio?: string | null;
  links: SchedulingLinkData[];
  avatarUrl?: string | null;
  compact?: boolean;
  /** Sin tarjeta propia: para ir dentro de otra que ya pone el marco y el título. */
  bare?: boolean;
  /**
   * ¿Puede quien mira usar los links prioritarios? Un cliente sin soporte
   * prioritario en su plan los ve bloqueados. El staff siempre puede.
   */
  priorityUnlocked?: boolean;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      style={{
        ...(bare
          ? {}
          : {
              backgroundColor: "var(--app-card-bg)",
              border: "1px solid var(--app-border)",
              borderRadius: "0.75rem",
              padding: compact ? "1rem" : "1.25rem",
            }),
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
              {link.isPriority && !priorityUnlocked ? (
                <LockedPriorityLink title={link.title} description={link.description} />
              ) : (
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
                  <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", fontWeight: 600, color: "#fd1384", flexWrap: "wrap" }}>
                    {link.title}
                    <ExternalLink style={{ width: "0.75rem", height: "0.75rem", flexShrink: 0 }} />
                    {link.isPriority && <PriorityTag />}
                  </span>
                  {link.description && (
                    <span style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.125rem" }}>
                      {link.description}
                    </span>
                  )}
                </span>
              </a>
              )}
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

/** Etiqueta de un link de agendamiento prioritario. */
export function PriorityTag() {
  return (
    <span
      style={{
        fontSize: "0.625rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        padding: "0.1rem 0.45rem",
        borderRadius: "9999px",
        backgroundColor: "rgba(253,19,132,0.12)",
        color: "#fd1384",
      }}
    >
      Prioritario
    </span>
  );
}

/**
 * Link prioritario para un cliente cuyo plan no lo incluye: se ve que existe
 * —y qué ofrece— pero no se puede abrir. La URL no llega al navegador.
 */
function LockedPriorityLink({ title, description }: { title: string; description: string | null }) {
  return (
    <div
      aria-disabled="true"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.5rem",
        border: "1px dashed var(--app-border)",
        borderRadius: "0.5rem",
        padding: "0.625rem 0.75rem",
        backgroundColor: "var(--app-bg)",
        cursor: "not-allowed",
      }}
    >
      <Lock style={{ width: "1rem", height: "1rem", color: "var(--app-text-muted)", flexShrink: 0, marginTop: "0.125rem" }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", fontWeight: 600, color: "var(--app-text-muted)", flexWrap: "wrap" }}>
          {title}
          <PriorityTag />
        </span>
        {description && (
          <span style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", marginTop: "0.125rem", opacity: 0.8 }}>
            {description}
          </span>
        )}
        <span style={{ display: "block", fontSize: "0.75rem", color: "var(--app-body-text)", marginTop: "0.375rem", lineHeight: 1.45 }}>
          Disponible con <strong>soporte prioritario</strong>. Ponte en contacto con tu agente para elevar tu plan.
        </span>
      </span>
    </div>
  );
}
