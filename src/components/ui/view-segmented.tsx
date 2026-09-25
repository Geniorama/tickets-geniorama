import Link from "next/link";

/**
 * Selector de vista (lista, tarjetas, kanban…) de un listado. Es un control
 * secundario: va junto a los resultados, no con las acciones de la cabecera,
 * y por eso es un segmentado discreto en vez de botones del mismo peso que
 * «Nuevo …».
 */
export function ViewSegmented<T extends string>({
  current,
  options,
}: {
  current: T;
  options: { id: T; label: string; href: string; Icon: React.ElementType }[];
}) {
  return (
    <div
      role="group"
      aria-label="Vista"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.125rem",
        padding: "0.125rem",
        border: "1px solid var(--app-border)",
        borderRadius: "0.5rem",
        backgroundColor: "var(--app-card-bg)",
      }}
    >
      {options.map(({ id, label, href, Icon }) => {
        const active = current === id;
        return (
          <Link
            key={id}
            href={href}
            aria-current={active ? "true" : undefined}
            title={`Ver en ${label.toLowerCase()}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              padding: "0.25rem 0.55rem",
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
              fontWeight: active ? 600 : 500,
              textDecoration: "none",
              backgroundColor: active ? "rgba(253,19,132,0.1)" : "transparent",
              color: active ? "#fd1384" : "var(--app-text-muted)",
            }}
          >
            <Icon style={{ width: "0.875rem", height: "0.875rem" }} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
