import { ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";

/**
 * El mapa de arriba de las pantallas de integraciones: una tarjeta por tipo,
 * con lo que hace en una frase, un ejemplo y si ya está funcionando.
 *
 * Lo que más confunde no es cómo se configura cada una sino cuál hace falta.
 * Por eso cada tarjeta dice hacia dónde va la información —la plataforma avisa
 * fuera, algo de fuera escribe dentro, o se conversa—, que es lo que distingue
 * un hook de una llave aunque los dos «conecten con n8n».
 */

export type IntegrationDirection = "sale" | "entra" | "conversa";

export type IntegrationCard = {
  /** Ancla de la sección que la configura. Dos tarjetas pueden compartirla. */
  id: string;
  icon: React.ReactNode;
  title: string;
  /** Para qué sirve, en una frase. */
  purpose: string;
  example: string;
  direction: IntegrationDirection;
  status: { tone: "ok" | "off" | "warn"; text: string };
  /** Si la tarjeta lleva a otra página en vez de a la sección de abajo. */
  href?: string;
};

const DIRECTIONS: Record<IntegrationDirection, { label: string; Icon: typeof ArrowUpRight }> = {
  sale: { label: "La plataforma avisa", Icon: ArrowUpRight },
  entra: { label: "Escribe en la plataforma", Icon: ArrowDownLeft },
  conversa: { label: "Conversa", Icon: ArrowLeftRight },
};

const TONES = {
  ok: { color: "#15803d", dot: "#16a34a" },
  warn: { color: "#b45309", dot: "#f59e0b" },
  off: { color: "var(--app-text-muted)", dot: "#9ca3af" },
} as const;

export function IntegrationMap({ cards }: { cards: IntegrationCard[] }) {
  return (
    <nav aria-label="Tipos de integración" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))", gap: "0.75rem" }}>
      {cards.map((card) => {
        const dir = DIRECTIONS[card.direction];
        const tone = TONES[card.status.tone];
        return (
          <a
            key={`${card.id}:${card.title}`}
            href={card.href ?? `#${card.id}`}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              padding: "0.875rem 1rem",
              borderRadius: "0.75rem",
              border: "1px solid var(--app-border)",
              backgroundColor: "var(--app-card-bg)",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", fontWeight: 600, color: "var(--app-body-text)" }}>
              {card.icon}
              {card.title}
            </span>
            <span style={{ fontSize: "0.8125rem", color: "var(--app-body-text)", lineHeight: 1.5 }}>{card.purpose}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--app-text-muted)", lineHeight: 1.5 }}>
              <em>Ej.:</em> {card.example}
            </span>
            <span style={{ marginTop: "auto", paddingTop: "0.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "0.6875rem", fontWeight: 600, color: "var(--app-text-muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                <dir.Icon style={{ width: "0.75rem", height: "0.75rem" }} />
                {dir.label}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: tone.color }}>
                <span aria-hidden style={{ width: "0.4rem", height: "0.4rem", borderRadius: "9999px", backgroundColor: tone.dot }} />
                {card.status.text}
              </span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}

/**
 * El encabezado común de cada sección: qué es, para qué sirve y, si hace
 * falta, cuándo no es la herramienta adecuada.
 */
export function IntegrationSection({
  id, icon, title, intro, notFor, children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  intro: React.ReactNode;
  /** «No es para…»: la confusión más común con otra integración. */
  notFor?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ scrollMarginTop: "1rem" }}>
      <div style={{ marginBottom: "0.875rem" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: "0.5rem", margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--app-body-text)" }}>
          {icon}
          {title}
        </h2>
        <p style={{ margin: "0.375rem 0 0", fontSize: "0.8125rem", color: "var(--app-text-muted)", lineHeight: 1.55 }}>{intro}</p>
        {notFor && (
          <p style={{ margin: "0.375rem 0 0", fontSize: "0.75rem", color: "var(--app-text-muted)", lineHeight: 1.55 }}>
            <strong>No es para:</strong> {notFor}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}
