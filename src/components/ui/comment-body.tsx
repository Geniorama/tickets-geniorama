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
              className="inline-block rounded px-1 font-semibold text-[0.875em] bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-300"
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
