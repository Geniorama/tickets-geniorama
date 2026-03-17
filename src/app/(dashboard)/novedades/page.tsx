import { readFile } from "fs/promises";
import path from "path";
import { Sparkles } from "lucide-react";

// ─── Parser ───────────────────────────────────────────────────────────────────

interface Item {
  text: string;
  children: string[];
}

interface Section {
  name: string;
  items: Item[];
}

interface Release {
  version: string;
  date: string;
  sections: Section[];
}

function parseChangelog(content: string): Release[] {
  const releases: Release[] = [];

  const blocks = content.split(/\n(?=## )/);

  for (const block of blocks) {
    const lines = block.split("\n");
    const heading = lines[0];
    if (!heading.startsWith("## ")) continue;
    if (heading.includes("[Unreleased]")) continue;

    // Extract version from "## [1.4.0] — 2026-03-17"
    const versionMatch = heading.match(/\[(\d+\.\d+\.\d+)\]/);
    if (!versionMatch) continue;
    const version = versionMatch[1];

    // Extract date
    const dateMatch = heading.match(/(\d{4}-\d{2}-\d{2})/);
    const rawDate = dateMatch?.[1];
    const date = rawDate
      ? new Date(`${rawDate}T12:00:00Z`).toLocaleDateString("es-CO", {
          day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
        })
      : "";

    const sections: Section[] = [];
    let currentSection: Section | null = null;
    let currentItem: Item | null = null;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith("### ")) {
        if (currentSection) sections.push(currentSection);
        currentSection = { name: line.slice(4).trim(), items: [] };
        currentItem = null;
        continue;
      }

      if (!currentSection) continue;

      // Top-level bullet
      if (/^- /.test(line)) {
        currentItem = { text: line.slice(2).trim(), children: [] };
        currentSection.items.push(currentItem);
        continue;
      }

      // Nested bullet (2 or 4 spaces + "- ")
      if (/^ {2,4}- /.test(line) && currentItem) {
        currentItem.children.push(line.replace(/^ {2,4}- /, "").trim());
        continue;
      }
    }

    if (currentSection) sections.push(currentSection);
    if (sections.length > 0) releases.push({ version, date, sections });
  }

  return releases;
}

// ─── Inline markdown renderer (bold + code) ───────────────────────────────────

function InlineText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              style={{
                backgroundColor: "rgba(128,128,255,0.15)",
                padding: "0.1rem 0.3rem",
                borderRadius: "0.25rem",
                fontFamily: "monospace",
                fontSize: "0.8em",
              }}
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ─── Section config ───────────────────────────────────────────────────────────

const SECTION_STYLE: Record<string, { accent: string; bg: string; badge: string; emoji: string }> = {
  "Añadido":  { accent: "#10b981", bg: "#d1fae520", badge: "#dcfce7", emoji: "✨" },
  "Mejorado": { accent: "#6366f1", bg: "#e0e7ff20", badge: "#e0e7ff", emoji: "⚡" },
  "Corregido":{ accent: "#f59e0b", bg: "#fef3c720", badge: "#fef3c7", emoji: "🔧" },
  "Eliminado":{ accent: "#ef4444", bg: "#fee2e220", badge: "#fee2e2", emoji: "🗑" },
};

const DEFAULT_STYLE = { accent: "#6b7280", bg: "transparent", badge: "#f3f4f6", emoji: "•" };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function NovedadesPage() {
  const filePath = path.join(process.cwd(), "CHANGELOG.md");
  const content = await readFile(filePath, "utf-8");
  const releases = parseChangelog(content);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.375rem" }}>
          <Sparkles style={{ width: "1.25rem", height: "1.25rem", color: "#6366f1" }} />
          <h1 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--app-body-text)" }}>
            Novedades
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--app-text-muted)" }}>
          Historial de mejoras, funciones nuevas y correcciones de la plataforma.
        </p>
      </div>

      {/* Timeline */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
        {releases.map((release, ri) => {
          const isFirst = ri === 0;
          return (
            <div key={ri} style={{ display: "flex", gap: "1.25rem", paddingBottom: "2rem" }}>

              {/* Timeline line + dot */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, width: "1rem" }}>
                <div
                  style={{
                    width: "0.75rem",
                    height: "0.75rem",
                    borderRadius: "9999px",
                    backgroundColor: isFirst ? "#6366f1" : "var(--app-border)",
                    border: `2px solid ${isFirst ? "#6366f1" : "var(--app-border)"}`,
                    marginTop: "0.3rem",
                    flexShrink: 0,
                    zIndex: 1,
                    boxShadow: isFirst ? "0 0 0 3px #6366f130" : "none",
                  }}
                />
                {ri < releases.length - 1 && (
                  <div style={{ flex: 1, width: "2px", backgroundColor: "var(--app-border)", marginTop: "0.25rem" }} />
                )}
              </div>

              {/* Card */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Version + date + badge */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.875rem", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: "1rem",
                      fontWeight: 700,
                      color: isFirst ? "#6366f1" : "var(--app-body-text)",
                      opacity: isFirst ? 1 : 0.7,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    v{release.version}
                  </span>
                  {release.date && (
                    <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", opacity: 0.7 }}>
                      {release.date}
                    </span>
                  )}
                  {isFirst && (
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        padding: "0.2rem 0.6rem",
                        borderRadius: "9999px",
                        backgroundColor: "#6366f1",
                        color: "#fff",
                        letterSpacing: "0.03em",
                      }}
                    >
                      Última versión
                    </span>
                  )}
                </div>

                {/* Sections */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {release.sections.map((section, si) => {
                    const style = SECTION_STYLE[section.name] ?? DEFAULT_STYLE;
                    return (
                      <div
                        key={si}
                        style={{
                          backgroundColor: "var(--app-card-bg)",
                          border: "1px solid var(--app-border)",
                          borderRadius: "0.75rem",
                          overflow: "hidden",
                        }}
                      >
                        {/* Section header */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.625rem 1rem",
                            borderBottom: "1px solid var(--app-border)",
                            backgroundColor: style.bg,
                          }}
                        >
                          <span style={{ fontSize: "0.875rem" }}>{style.emoji}</span>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              color: style.accent,
                              textTransform: "uppercase",
                              letterSpacing: "0.06em",
                            }}
                          >
                            {section.name}
                          </span>
                        </div>

                        {/* Items */}
                        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3" style={{ margin: 0, padding: "0.75rem 1rem", listStyle: "none", gap: "0.5rem" }}>
                          {section.items.map((item, ii) => (
                            <li key={ii}>
                              <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                                <span style={{ color: style.accent, marginTop: "0.1rem", flexShrink: 0, fontWeight: 700, opacity: 0.6 }}>—</span>
                                <span style={{ fontSize: "0.875rem", color: "var(--app-body-text)", lineHeight: 1.55, opacity: 0.8 }}>
                                  <InlineText text={item.text} />
                                </span>
                              </div>
                              {item.children.length > 0 && (
                                <ul style={{ margin: "0.375rem 0 0 1.25rem", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                  {item.children.map((child, ci) => (
                                    <li key={ci} style={{ display: "flex", gap: "0.375rem", alignItems: "flex-start" }}>
                                      <span style={{ color: "var(--app-text-muted)", flexShrink: 0, fontSize: "0.75rem", marginTop: "0.2rem" }}>›</span>
                                      <span style={{ fontSize: "0.8125rem", color: "var(--app-text-muted)", lineHeight: 1.5, opacity: 0.75 }}>
                                        <InlineText text={child} />
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>

  );
}
