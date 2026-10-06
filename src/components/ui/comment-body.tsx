"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { markdownComponents } from "@/components/ui/markdown-renderer";

/**
 * Renderiza el cuerpo de un comentario como Markdown: negritas, listas,
 * citas, código, tablas y enlaces. Además:
 *
 *   · Las menciones `@[Nombre](id)` salen como pastilla con el nombre.
 *   · Una URL pegada (`https://…` o `www.…`) es clicable sin más (GFM).
 *   · Un salto de línea es un salto de línea. Markdown lo trataría como un
 *     espacio, pero los comentarios se escriben como un mensaje, y los que ya
 *     existían son texto plano: sin esto se juntarían en un solo párrafo.
 *
 * `react-markdown` no interpreta HTML y descarta los enlaces que no son
 * seguros (`javascript:`, `data:`…), así que un comentario no puede inyectar
 * nada. Los enlaces abren en otra pestaña y sin `opener`.
 */

const MENTION = /@\[([^\]]+)\]\(([^)\s]+)\)/g;
const MENTION_HREF = "#mention-";

/** El nombre va dentro de un enlace Markdown: sus caracteres especiales se escapan. */
function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_[\]<>~]/g, "\\$&");
}

/**
 * Las menciones se pasan a enlaces con un destino propio, que luego el
 * componente `a` reconoce y pinta como pastilla. Así viajan por el Markdown
 * como cualquier otro texto en línea (dentro de una lista, de una negrita…).
 */
function withMentions(body: string): string {
  return body.replace(
    MENTION,
    (_, name: string, id: string) => `[@${escapeMarkdown(name)}](${MENTION_HREF}${encodeURIComponent(id)})`,
  );
}

type MdNode = { type: string; value?: string; children?: MdNode[] };

/** Convierte los saltos de línea del texto en saltos de verdad (`<br>`). */
function remarkLineBreaks() {
  const walk = (node: MdNode) => {
    if (!node.children) return;
    const next: MdNode[] = [];
    for (const child of node.children) {
      if (child.type === "text" && child.value?.includes("\n")) {
        child.value.split("\n").forEach((line, i) => {
          if (i > 0) next.push({ type: "break" });
          if (line) next.push({ type: "text", value: line });
        });
      } else {
        walk(child);
        next.push(child);
      }
    }
    node.children = next;
  };
  return (tree: MdNode) => walk(tree);
}

const components: Components = {
  ...markdownComponents,
  // Un comentario es un mensaje, no un documento: títulos contenidos
  h1: ({ children }) => <p style={{ fontSize: "1.0625rem", fontWeight: 700, marginBottom: "0.4rem" }}>{children}</p>,
  h2: ({ children }) => <p style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.4rem" }}>{children}</p>,
  h3: ({ children }) => <p style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.3rem" }}>{children}</p>,
  p: ({ children }) => <p style={{ marginBottom: "0.5rem", lineHeight: 1.55 }}>{children}</p>,
  li: ({ children }) => <li style={{ marginBottom: "0.15rem" }}>{children}</li>,
  strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
  a: ({ href, children }) => {
    if (href?.startsWith(MENTION_HREF)) {
      return (
        <span className="inline-block rounded px-1 font-semibold text-[0.875em] bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-300">
          {children}
        </span>
      );
    }
    // Sin destino seguro (lo vació react-markdown): se queda como texto
    if (!href) return <>{children}</>;
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline underline-offset-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-300 dark:hover:text-indigo-200"
      >
        {children}
      </a>
    );
  },
};

export function CommentBody({
  body,
  style,
  className,
}: {
  body: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      style={{ lineHeight: 1.55, overflowWrap: "anywhere", ...style }}
      // El último bloque no deja hueco debajo: el comentario ya tiene su margen
      className={`[&>*:last-child]:mb-0 ${className ?? ""}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkLineBreaks]} components={components}>
        {withMentions(body)}
      </ReactMarkdown>
    </div>
  );
}
