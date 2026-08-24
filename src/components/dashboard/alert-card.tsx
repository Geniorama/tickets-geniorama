import Link from "next/link";

/**
 * Una tarjeta de «esto va mal» con una o dos listas dentro.
 *
 * Existe porque el inicio tenía cuatro bloques con exactamente el mismo
 * marcado —vencidas, por vencer, planes vencidos, planes por vencer— copiado
 * cuatro veces. Además permite meter dos listas en una sola tarjeta, que es
 * cómo se arregla que «Por vencer (1)» ocupe una columna entera para una fila.
 */

export type AlertRow = {
  id: string;
  title: string;
  /** Debajo del título: el proyecto, la empresa… */
  context: string | null;
  /** A la derecha: la fecha, los días que faltan. */
  meta: string;
  href?: string;
};

export type AlertSection = {
  label: string;
  tone: "grave" | "aviso";
  rows: AlertRow[];
  /** Cuántos hay en total, para el «ver N más». */
  total: number;
  moreHref: string;
};

const TONES = {
  grave: { color: "#dc2626", border: "rgba(239,68,68,0.25)", bg: "rgba(239,68,68,0.05)" },
  aviso: { color: "#d97706", border: "rgba(245,158,11,0.30)", bg: "rgba(245,158,11,0.05)" },
} as const;

export function AlertCard({
  icon: Icon,
  sections,
}: {
  icon: React.ElementType;
  sections: AlertSection[];
}) {
  const conFilas = sections.filter((s) => s.rows.length > 0);
  if (conFilas.length === 0) return null;

  // El color del borde lo marca lo más grave que haya dentro.
  const tono = TONES[conFilas.some((s) => s.tone === "grave") ? "grave" : "aviso"];

  return (
    <div
      style={{
        backgroundColor: tono.bg,
        border: `1px solid ${tono.border}`,
        borderRadius: "0.75rem",
        padding: "1.25rem",
        display: "flex", flexDirection: "column", gap: "1.25rem",
      }}
    >
      {conFilas.map((section, i) => {
        const st = TONES[section.tone];
        const restantes = section.total - section.rows.length;
        return (
          <div
            key={section.label}
            style={i > 0 ? { borderTop: `1px solid ${tono.border}`, paddingTop: "1.25rem" } : undefined}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.85rem" }}>
              <Icon style={{ width: "1rem", height: "1rem", color: st.color, flexShrink: 0 }} />
              <p style={{ fontSize: "0.8125rem", fontWeight: 600, color: st.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {section.label} ({section.total})
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {section.rows.map((row) => {
                const contenido = (
                  <>
                    <span style={{ overflow: "hidden", minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--app-body-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {row.title}
                      </span>
                      {row.context && (
                        <span style={{ display: "block", fontSize: "0.75rem", color: "var(--app-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row.context}
                        </span>
                      )}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: st.color, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {row.meta}
                    </span>
                  </>
                );

                const estilo: React.CSSProperties = {
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  gap: "0.5rem", textDecoration: "none",
                };

                return row.href
                  ? <Link key={row.id} href={row.href} style={estilo}>{contenido}</Link>
                  : <div key={row.id} style={estilo}>{contenido}</div>;
              })}
            </div>

            {restantes > 0 && (
              <Link
                href={section.moreHref}
                style={{ display: "block", marginTop: "0.75rem", fontSize: "0.8125rem", color: st.color, textDecoration: "none", fontWeight: 500 }}
              >
                Ver {restantes} más →
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}
