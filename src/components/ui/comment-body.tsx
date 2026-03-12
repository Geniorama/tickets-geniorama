/**
 * Renderiza el cuerpo de un comentario convirtiendo las menciones
 * @[Name](id) en pills visuales. El resto del texto se muestra tal cual.
 */
export function CommentBody({
  body,
  style,
  className,
}: {
  body: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  const parts = body.split(/(@\[[^\]]+\]\([^)]+\))/g);

  return (
    <p
      style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, ...style }}
      className={className}
    >
      {parts.map((part, i) => {
        const match = part.match(/^@\[([^\]]+)\]\([^)]+\)$/);
        if (match) {
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                backgroundColor: "#fd1384",
                color: "#ffffff",
                borderRadius: "0.25rem",
                padding: "0 0.3rem",
                fontWeight: 600,
                fontSize: "0.875em",
              }}
            >
              @{match[1]}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}
